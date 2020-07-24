'use strict';

let
	URL = (globalThis || {}).URL;

if (!URL) {
	URL = require('url').URL;
}

const
	axios = require('axios'),
	merge = require('merge'),
	CustomPromise = require('@trenskow/custom-promise');

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

			const apiUrl = new URL(path, baseUrl);
	
			let headers = opt.headers || {};

			if (typeof opt.payload !== 'undefined') {
				headers['Content-Type'] = 'application/json; charset=utf-8';
			}
	
			const handleResponse = (response) => {
				if ((((response || {}).data || {}).error)) {
					this._reject(ApiError.parse(response.data.error, response.status, apiUrl.href));
				} else {
					this._resolve(response.data);
				}
			};

			let originalResponse;
			let originalError;

			axios({
				method: method,
				url: apiUrl.href,
				headers,
				data: JSON.stringify(opt.payload),
				params: opt.query
			}).then((response) => {
				originalResponse = response;
				if (!this._responseCallback) return originalResponse;
				return Promise.resolve(this._responseCallback(originalResponse));
			}).then((response) => {
				handleResponse(response || originalResponse);
			}).catch((error) => {
				originalError = error;
				originalResponse = error.response;
				if (!this._responseCallback) throw error;
				return Promise.resolve(this._responseCallback(error.response));
			}).then((response) => {
				originalError.response = response || originalResponse;
				throw originalError;
			}).catch((error) => {
				if (((error.response || {}).data || {}).error) {
					handleResponse(error.response);
				} else {
					this._reject(error);
				}
			});

		}

		onResponse(responseCallback) {
			this._responseCallback = responseCallback;
			return this;
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
