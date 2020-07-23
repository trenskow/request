'use strict';

const
	{ URL } = require('url');

const
	axios = require('axios'),
	merge = require('merge'),
	CustomPromise = require('@trenskow/custom-promise');

const
	{ ApiError } = require('@trenskow/apierror');

exports = module.exports = (baseUrl, options = {}) => {

	try {
		baseUrl = new URL(baseUrl);
	} catch (_) {
		throw new SyntaxError('baseUrl must be a URL or a string containing a URL.');
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
	
			const handleResponse = (response) => {
				if ((((response || {}).data || {}).error)) {
					this._reject(ApiError.parse(response.data.error, response.status, apiUrl.href));
				} else {
					if (this._responseCallback) this._responseCallback(response);
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
		get: async (path, opt) => {
			return await request('get', path, opt);
		},
		post: async (path, opt) => {
			return await request('post', path, opt);
		},
		put: async (path, opt) => {
			return await request('put', path, opt);
		},
		delete: async (path, opt) => {
			return await request('delete', path, opt);
		}
	});

};
