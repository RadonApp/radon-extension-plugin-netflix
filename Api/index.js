import Merge from 'lodash-es/merge';
import URI from 'urijs';

import {fetch} from '@radon-extension/framework/Core/Fetch';

import MetadataInterface from './Interfaces/Metadata';
import ShimApi from './Shim';


const BaseUrl = 'https://www.netflix.com/api/shakti';

export class Api {
    constructor() {
        // Construct interfaces
        this.metadata = new MetadataInterface(this);
    }

    request(method, path, options) {
        options = Merge({
            query: {}
        }, options || {});

        // Retrieve configuration
        return ShimApi.configuration().then(function({ serverDefs }) {
            // Add default parameters
            options.query = Merge({
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
