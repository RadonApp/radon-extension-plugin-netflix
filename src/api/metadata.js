import request from 'superagent';

import ShimApi from './shim';


class NetflixMetadataApi {
    get(id, imageFormat) {
        // Retrieve endpoint identifier
        return ShimApi.request('serverDefs')
            .then(function(serverDefs) {
                // Retrieve endpoint identifier
                return serverDefs.endpointIdentifiers['/metadata']
            })
            .then(function(endpointIdentifier) {
                // Request metadata from netflix api
                return request
                    .get('https://www.netflix.com/api/shakti/metadata/' + endpointIdentifier)
                    .query({
                        movieid: id,
                        imageFormat: imageFormat || 'webp',
                        _: Date.now()
                    });
            })
            .then(function(response) {
                if(!response.ok) {
                    return Promise.reject('Invalid response returned');
                }

                return response.body;
            });
    }
}

export default new NetflixMetadataApi();
