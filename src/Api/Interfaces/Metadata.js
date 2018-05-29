import Interface from './Base';


export default class MetadataInterface extends Interface {
    get(id, options) {
        options = {
            'imageFormat': 'webp',

            'canWatchBranchingTitles': false,
            'fetchListAnnotations': false,
            'isWatchlistEnabled': false,
            'isShortformEnabled': false,
            'materialize': true,
            'withSize': true,

            ...(options || {})
        };

        return this._client.request('GET', '/metadata', {
            query: {
                movieid: id,
                ...options
            }
        });
    }
}
