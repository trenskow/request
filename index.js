'use strict';

let
	URL = (window || {}).URL;

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
	
			opt = merge(true, options, opt || {});

			const apiUrl = new URL(path, baseUrl);
	
			let headers = opt.headers || {};

			if (typeof opt.payload !== 'undefined') {
				headers['Content-Type'] = 'application/json; charset=utf-8';
			}
	
			const handleResponse = (response) => {
				if (this._responseCallback) this._responseCallback(response);
				if ((((response || {}).data || {}).error)) {
					this._reject(ApiError.parse(response.data.error, response.status, apiUrl.href));
				} else {
					this._resolve(response.data);
				}
			};
	
			axios({
				method: method,
				url: apiUrl.href,
				headers,
				data: JSON.stringify(opt.payload),
				params: opt.query
			}).then((response) => {
				handleResponse(response);
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
