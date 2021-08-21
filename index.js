'use strict';

const
	{ isBrowser } = require('browser-or-node');

const
	URL = isBrowser ? (window || {}).URL : require('url').URL;

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

			this._listeners = {};

			setImmediate(() => {

				this._exec()
					.then((result) => this._resolve(result))
					.catch((error) => this._reject(error));

			});

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

		on(event, listener) {
			this._listeners[event] = this._listeners[event] || [];
			this._listeners[event].push(listener);
			return this;
		}

		async _emit(event, ...args) {
			await Promise.all((this._listeners[event] || []).map(async (listener) => {
				await Promise.resolve(listener(...args));
			}));
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

			if (!(error.response)) return { result: error };

			const status = error.response.status;

			if (!(error.response || {}).data) return { status, result: error };

			if (this._resultType === 'stream') error.response.data = await streamReader(error.response.data);

			error.response = this._convertResponse(error.response);

			if (!(error.response.data || {}).error) return { status, result: error };

			const message = error.response.data.error.message;

			error = ApiError.parse(merge(true, error.response.data.error, { message: (message || {}).keyPath || message }), error.response.status, this._apiUrl.href);
			error._options = merge(error._options || { parameters: (message || {}).parameters });

			return { status, result: error };

		}

		async _handleResponse(response) {

			const status = response.status;

			if (['buffer', 'stream'].includes(this._resultType)) {
				return { status, result: response.data };
			}

			return { status, result: this._convertResponse(response).data };

		}

		async _exec() {

			const request = {
				method: this._method,
				url: this._apiUrl.href,
				headers: this._headers,
				data: this._payload,
				params: this._query,
				responseType: this._resultType === 'stream' ? 'stream' : 'arraybuffer'
			};

			await this._emit('request', request);

			let response;

			try {
				response = ['response', await this._handleResponse(await axios(request), request)];
			} catch (error) {
				response = ['error', await this._handleError(error, request)];
			}

			let [event, { status, result }] = response;

			await this._emit(event, result, status, request);

			switch (event) {
				case 'response':
					return result;
				case 'error':
					throw result;
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
