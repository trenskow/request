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
	isStream = require('is-stream'),
	methods = require('methods');

const
	ApiError = require('@trenskow/api-error');

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

			opt = opt || {};
	
			this._apiUrl = new URL(path, baseUrl);

			let useOptions = {};

			useOptions.headers = merge({}, options.headers, opt.headers || {});
			useOptions.query = merge({}, options.query, opt.query || {});

			this._headers = useOptions.headers || {};
			this._query = useOptions.query;
			this._payload = opt.payload;

			this._method = method;

			this._resultType = 'parsed';

			if (typeof opt.payload !== 'undefined') {
				if (Buffer.isBuffer(opt.payload) || isStream.readable(opt.payload)) {
					this._headers['Content-Type'] = opt.contentType;
				} else {
					this._headers['Content-Type'] = 'application/json; charset=utf-8';
					this._payload = Buffer.from(JSON.stringify(this._payload));
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
			return this;
		}

		asBuffer() {
			this._resultType = 'buffer';
			return this;
		}

		_isJSON(response) {
			return /^application\/json/.test(response.headers['content-type']);
		}

		_convertResponse(response) {
			if (/^application\/json/.test(response.headers['content-type'])) {
				if (isBrowser && response.data instanceof ArrayBuffer) response.data = new TextDecoder('utf-8').decode(new Uint8Array(response.data));
				response.data = JSON.parse(response.data);
			}
			return response;
		}

		async _handleError(error) {

			if (!(error.response)) throw error;

			error.response = this._responseCallback ? (await Promise.resolve(this._responseCallback(error.response, error)) || error.response) : error.response;
			
			if (!(error.response || {}).data) throw error;

			if (this._resultType === 'stream') error.response.data = await streamReader(error.response.data);

			error.response = this._convertResponse(error.response);

			if (!(error.response.data || {}).error) throw error;

			const message = error.response.data.error.message;

			error = ApiError.parse(merge(true, error.response.data.error, { message: (message || {}).keyPath || message }), error.response.status, this._apiUrl.href);
			error._options = merge(error._options || { parameters: (message || {}).parameters});

			throw error;

		}

		async _handleResponse(response) {

			response = this._responseCallback ? (await Promise.resolve(this._responseCallback(response)) || response) : response;

			if (this._resultType === 'stream') return response.data;

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

	methods.forEach((method) => {
		request[method] = (path, opt) => {
			return request(method, path, opt);
		};
	});

	return request;

};
