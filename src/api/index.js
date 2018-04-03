import merge from 'lodash-es/merge';
import URI from 'urijs';

import {fetch} from 'neon-extension-framework/core/fetch';

import MetadataInterface from './interfaces/metadata';
import Shim from './shim';


const BaseUrl = 'https://www.netflix.com/api/shakti';

export class Api {
    constructor() {
        // Construct interfaces
        this.metadata = new MetadataInterface(this);
    }

    request(method, path, options) {
        options = merge({
            query: {}
        }, options || {});

        // Retrieve configuration
        return Shim.configuration().then(function({ serverDefs }) {
            // Add default parameters
            options.query = merge({
                _: Date.now()
            }, options.query || {});

            // Build URL
            let url = new URI(BaseUrl + '/' + serverDefs['BUILD_IDENTIFIER'] + path)
                .search(options.query)
                .toString();

            // Send request
            return fetch(url, {
                method: method,
                credentials: 'include'
            });
        }).then((response) => {
            if(!response.ok) {
                return Promise.reject(new Error('Request failed'));
            }

            // TODO Verify content-type
            return response.json();
        });
    }
}

export default new Api();
