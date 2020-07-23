'use strict';

const
	{ URL } = require('url');

const
	axios = require('axios'),
	merge = require('merge');

const
	{ ApiError } = require('@trenskow/apierror');

exports = module.exports = (baseUrl, options = {}) => {

	try {
		baseUrl = new URL(baseUrl);
	} catch (_) {
		throw new SyntaxError('baseUrl must be a URL or a string containing a URL.');
	}

	const request = async (method, path, opt) => {

		path = path || '';
		opt = opt || {};

		opt = merge(true, options, opt);

		if (Array.isArray(path)) {
			path = path.map(encodeURIComponent).join('/');
		}
		else if (path.indexOf('/') === -1) {
			path = encodeURIComponent(path);
		}

		const apiUrl = new URL(path, baseUrl);

		let headers = opt.headers || {};

		let response;
		try {
			response = await axios({
				method: method,
				url: apiUrl.href,
				headers,
				data: JSON.stringify(opt.payload),
				params: opt.query
			}).data;
		} catch (error) {
			if (((error.response || {}).data || {}).error) {
				response = error.response;
			} else {
				throw error;
			}
		}

		if ((((response || {}).data || {}).error)) {
			throw ApiError.parse(response.data.error, response.status, apiUrl.href);
		}

		return response;

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
