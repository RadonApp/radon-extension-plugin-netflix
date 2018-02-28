import {Movie, Show, Season, Episode} from 'neon-extension-framework/models/item/video';

import Log from '../../../core/logger';
import Plugin from '../../../core/plugin';


export default class Parser {
    static parse(metadata) {
        let item = metadata.video;

        if(item.type === 'movie') {
            return Parser.parseMovie(item);
        } else if(item.type === 'show') {
            return Parser.parseEpisodeFromShow(item);
        }

        Log.warn('Unknown metadata type: "' + item.type + '"');
        return null;
    }

    static parseMovie(movieInfo) {
        return Movie.create(Plugin.id, {
            keys: Parser._createKeys({
                id: movieInfo.id
            }),

            // Metadata
            title: movieInfo.title,
            year: movieInfo.year,
            duration: movieInfo.runtime * 1000
        });
    }

    static parseEpisodeFromShow(show) {
        let season, episode;
        let match = false;

        // Iterate over seasons
        for(let i = 0; i < show.seasons.length; ++i) {
            season = show.seasons[i];

            // Iterate over season episodes for match
            for(let j = 0; j < season.episodes.length; ++j) {
                episode = season.episodes[j];

                if(episode.id === show.currentEpisode) {
                    match = true;
                    break;
                }
            }

            if(match) {
                break;
            }
        }

        if(!match) {
            Log.warn('Unable to find metadata for episode %o', show.currentEpisode);
            return null;
        }

        // Construct metadata
        return Parser.parseEpisode(show, season, episode);
    }

    static parseEpisode(showInfo, seasonInfo, episodeInfo) {
        // Construct show
        let show = Show.create(Plugin.id, {
            keys: Parser._createKeys({
                id: showInfo.id
            }),

            // Metadata
            title: showInfo.title
            // TODO year?
        });

        // Construct season
        let season = Season.create(Plugin.id, {
            keys: Parser._createKeys({
                id: seasonInfo.id
            }),

            // Metadata
            title: seasonInfo.title,
            year: seasonInfo.year,
            number: seasonInfo.seq,

            // Children
            show
        });

        // Construct episode
        return Episode.create(Plugin.id, {
            keys: Parser._createKeys({
                id: episodeInfo.id
            }),

            // Metadata
            title: episodeInfo.title,
            number: episodeInfo.seq,
            duration: episodeInfo.runtime * 1000,

            // Children
            show,
            season
        });
    }

    // region Private Methods

    static _createKeys(keys) {
        // TODO Add `keys` with country suffixes
        return keys;
    }

    // endreigon
}
