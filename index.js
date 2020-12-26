'use strict';

const
	{ isBrowser } = require('browser-or-node');

const
	URL = isBrowser ? window.URL : require('url').URL;

const
	axios = require('axios'),
	merge = require('merge'),
	CustomPromise = require('@trenskow/custom-promise'),
	streamReader = require('@trenskow/stream-reader'),
	isStream = require('is-stream');

const
	ApiError = require('@trenskow/apierror');

exports = module.exports = (baseUrl, options = {}) => {

	if (baseUrl === 'string') {
		baseUrl = new URL(baseUrl);
	}

	class RequestPromise extends CustomPromise {

		constructor(method, path, opt) {
			super();
			
			path = path || '';
	
			if (Array.isArray(path)) {
				path = path.map(encodeURIComponent).join('/');
			}
			else if (path.indexOf('/') === -1) {
				path = encodeURIComponent(path);
			}
	
			opt = merge.recursive(true, options, opt || {});

			this._apiUrl = new URL(path, baseUrl);
	
			this._headers = opt.headers || {};
			this._payload = opt.payload;
			this._query = opt.query;

			this._method = method;

			this._resultType = 'parsed';

			if (typeof opt.payload !== 'undefined') {
				if (Buffer.isBuffer(opt.payload) || isStream.readable(opt.payload)) {
					this._headers['Content-Type'] = opt.contentType;
				} else {
					this._headers['Content-Type'] = 'application/json; charset=utf-8';
					opt.payload = JSON.stringify(opt.payload);
				}
			}

			setImmediate(() => {

				this._exec()
					.then((result) => this._resolve(result))
					.catch((error) => this._reject(error));

			});

		}

		onResponse(responseCallback) {
			this._responseCallback = responseCallback;
			return this;
		}

		asStream() {
			if (isBrowser) throw new Error('Streaming is not supported in the browser.');
			this._resultType = 'stream';
		}

		asBuffer() {
			this._resultType = 'buffer';
		}

		_isJSON(response) {
			return /^application\/json/.test(response.headers['content-type']);
		}

		_convertResponse(response) {
			if (/^application\/json/.test(response.headers['content-type'])) {
				response.data = JSON.parse(response.data);
			}
			return response;
		}

		async _handleError(error) {

			if (!(error.response || {}).data) throw error;

			if (this._resultType === 'stream') error.response.data = await streamReader(error.response.data);

			error.response = this._convertResponse(error.response.data.toString());

			if (this._responseCallback) error.response = await Promise.resolve(this._responseCallback(error.response, error)) || error.response;

			if (!(error.response.data || {}).error) throw error;

			throw ApiError.parse(error.response.data.error, error.response.status, this._apiUrl.href);

		}

		async _handleResponse(response) {

			if (this._resultType === 'stream') return response.data;

			if (this._responseCallback) response = await Promise.resolve(this._responseCallback(response)) || response;

			const buffer = response.data;

			if (this._resultType === 'buffer') return buffer;

			return this._convertResponse(response).data;

		}

		async _exec() {
			try {
				return await this._handleResponse(await axios({
					method: this._method,
					url: this._apiUrl.href,
					headers: this._headers,
					data: this._payload,
					params: this._query,
					responseType: this._resultType === 'stream' ? 'stream' : 'arraybuffer'}));
			} catch (error) {
				await this._handleError(error);
			}
		}
	
	}	

	const request = (method, path, opt) => {
		return new RequestPromise(method, path, opt);
	};

	return merge(request, {
		get: (path, opt) => {
			return request('get', path, opt);
		},
		post: (path, opt) => {
			return request('post', path, opt);
		},
		put: (path, opt) => {
			return request('put', path, opt);
		},
		delete: (path, opt) => {
			return request('delete', path, opt);
		},
		options: (path, opt) => {
			return request('options', path, opt);
		}
	});

};
