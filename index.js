import { isBrowser } from 'browser-or-node';

import { URL } from 'url';

import axios from 'axios';
import merge from 'merge';
import CustomPromise from '@trenskow/custom-promise';
import streamReader from '@trenskow/stream-reader';
import { isStream } from 'is-stream';
import methods from 'methods';
import caseit from '@trenskow/caseit';
import ApiError from '@trenskow/api-error';

export default (baseUrl, options = {}) => {

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
			this._output = 'payload';

			this._headerCasing = options.headerCasing || 'camel';

			if (typeof opt.payload !== 'undefined') {
				if (!Buffer.isBuffer(opt.payload) && !isStream.readable(opt.payload)) {
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

		withDetailedOutput() {
			this._output = 'detailed';
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

		_caseHeaders(headers, type) {

			if (this._headerCasing === 'none') return headers;

			let result = {};

			Object.keys(headers).forEach((key) => {
				result[caseit(key, type || this._headerCasing)] = headers[key];
			});

			return result;

		}

		_details(response) {
			return { status: response.status, headers: this._caseHeaders(response.headers) };
		}

		async _handleError(error) {

			if (!(error.response)) return { result: error };

			const response = error.response;

			if (!(error.response || {}).data) return { details: this._details(response), result: error };

			if (this._resultType === 'stream') error.response.data = await streamReader(error.response.data);

			error.response = this._convertResponse(error.response);

			if (!(error.response.data || {}).error) return { details: this._details(error.response), result: error };

			const message = error.response.data.error.message;

			error = ApiError.parse(merge(true, error.response.data.error, { message: (message || {}).keyPath || message }), error.response.status, this._apiUrl.href);
			error._options = merge(error._options || { parameters: (message || {}).parameters });

			return { details: this._details(response), result: error };

		}

		async _handleResponse(response) {

			if (['buffer', 'stream'].includes(this._resultType)) {
				return { details: this._details(response), result: response.data };
			}

			return { details: this._details(response), result: this._convertResponse(response).data };

		}

		async _exec() {

			const request = {
				method: this._method,
				url: this._apiUrl.href,
				headers: this._caseHeaders(this._headers, 'http'),
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

			let [event, { details, result }] = response;

			await this._emit(event, result, details, request);

			switch (event) {
				case 'response':
					switch (this._output) {
						case 'detailed':
							return {
								payload: result,
								status: details.status,
								headers: details.headers
							};
						default:
							return result;
					}
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
