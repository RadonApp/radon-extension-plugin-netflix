import {Movie, Show, Season, Episode} from 'eon.extension.framework/models/video';

import Log from 'eon.extension.source.netflix/core/logger';
import Plugin from 'eon.extension.source.netflix/core/plugin';


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
        return Movie.create(Plugin, movieInfo.id, {
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
        let show = Show.create(Plugin, showInfo.id, {
            title: showInfo.title
        });

        // Construct season
        let season = Season.create(Plugin, seasonInfo.id, {
            title: seasonInfo.title,
            year: seasonInfo.year,
            number: seasonInfo.seq,

            show: show
        });

        // Construct episode
        return Episode.create(Plugin, episodeInfo.id, {
            title: episodeInfo.title,
            number: episodeInfo.seq,
            duration: episodeInfo.runtime * 1000,

            show: show,
            season: season
        });
    }
}
