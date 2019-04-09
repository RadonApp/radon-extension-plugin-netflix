import Find from 'lodash-es/find';
import Get from 'lodash-es/get';
import IsNil from 'lodash-es/isNil';

import ActivityService, {ActivityEngine} from '@radon-extension/framework/Services/Source/Activity';
import Registry from '@radon-extension/framework/Core/Registry';

import Api from '../Api';
import Log from '../Core/Logger';
import PlayerMonitor from '../Player/Monitor';
import Plugin from '../Core/Plugin';
import ShimApi from '../Api/Shim';


export class NetflixActivityService extends ActivityService {
    constructor() {
        super(Plugin);

        this.player = new PlayerMonitor();
        this.engine = null;
    }

    initialize() {
        super.initialize();

        // Create activity engine
        this.engine = new ActivityEngine(this.plugin, {
            getMetadata: this.getMetadata.bind(this),

            isEnabled: () => true
        });

        // Bind activity engine to player monitor
        this.engine.bind(this.player);

        // Inject shim
        ShimApi.inject().then(() => {
            // Start monitoring player
            this.player.start();
        });
    }

    getMetadata(item) {
        let duration = this.player.getDuration();

        // Ensure duration is valid
        if(IsNil(duration) || duration <= 0) {
            return Promise.reject(new Error(
                'Unable to retrieve video duration'
            ));
        }

        // Retrieve identifier
        let id = Get(item.keys, [Plugin.id, 'id']);

        if(IsNil(id)) {
            return Promise.resolve(item);
        }

        let fetchedAt = Date.now();

        // Update item `fetchedAt` timestamp
        item.update(Plugin.id, { fetchedAt });

        // Update duration
        if(IsNil(item.duration) || duration > item.duration) {
            item.duration = duration;
        }

        // Fetch album metadata
        Log.debug('Fetching metadata for "%s" (item: %o)', id, item);

        return Api.metadata.get(id).then(({ video }) => {
            if(video.type === 'movie') {
                return this.updateMovie(item, video, fetchedAt);
            }

            if(video.type === 'show') {
                return this.updateEpisode(item, video, fetchedAt);
            }

            Log.info('Ignoring video with unknown type: %s', video.type);
            return null;
        });
    }

    updateEpisode(item, show, fetchedAt) {
        let { season, episode } = this.findEpisode(show, item.season.number, item.number);

        if(IsNil(season) || IsNil(episode)) {
            Log.warn('Unable to find episode %dx%d in %o', item.season.number, item.number, show);
            return item;
        }

        // Remove `id` from episode (unknown target, could be show or episode)
        delete item.keys[Plugin.id].id;

        // Retrieve show year (from first season)
        let year;

        if(show.seasons[0].seq === 1) {
            year = show.seasons[0].year;
        }

        // Update show
        item.season.show.update(Plugin.id, {
            keys: {
                id: show.id
            },

            // Metadata
            title: show.title,
            year,

            // Timestamps
            fetchedAt
        });

        // Update season
        item.season.update(Plugin.id, {
            keys: {
                id: season.id
            },

            // Metadata
            title: season.title,
            year: season.year,

            number: season.seq,

            // Timestamps
            fetchedAt
        });

        // Update episode
        item.update(Plugin.id, {
            keys: {
                id: episode.id
            },

            // Metadata
            title: episode.title,
            number: episode.seq,

            duration: episode.runtime * 1000,

            // Timestamps
            fetchedAt
        });

        return item;
    }

    updateMovie(item, movie, fetchedAt) {
        // Update movie
        item.update(Plugin.id, {
            keys: {
                id: movie.id
            },

            // Metadata
            title: movie.title,
            year: movie.year,

            duration: movie.runtime * 1000,

            // Timestamps
            fetchedAt
        });

        return item;
    }

    findEpisode(video, seasonNumber, number) {
        let season = Find(video.seasons, { seq: seasonNumber });

        if(IsNil(season)) {
            return {
                season: null,
                episode: null
            };
        }

        return {
            episode: Find(season.episodes, { seq: number }) || null,
            season
        };
    }
}

// Register service
Registry.registerService(new NetflixActivityService());
