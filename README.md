@trenskow/request
----

A small request library for usage with APIs that uses the [`@trenskow/apierror`](https://npmjs.org/package/@trenskow/apierror) package.

It is based of [Axios](https://github.com/axios/axios).

# Usage

````javascript
const request = require('@trenskow/request');

await request('https://api.mysite.com', { /* options */ }).get('/my/resource', { /* options */});
````

> Supported methods: `get`, `post`, `put`, `delete` and `options`.

## Options

| Name      | Type     | Description                        |
|:----------|:--------:|:-----------------------------------|
| `headers` | `Object` | Custom headers for the request(s). |
| `payload` | Any      | Whatever Axios supports.           |
| `query`   | `Object` | Object with keys and values.       |

# LICENSE

See LICENSE
