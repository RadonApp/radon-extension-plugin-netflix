import {Movie, Show, Season, Episode} from 'eon.extension.framework/models/metadata/video';

import Log from '../../../core/logger';
import Plugin from '../../../core/plugin';


export default class Parser {
    // region Public methods

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

    static parseMovie(movie) {
        return Parser._constructMovie(movie);
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
            Log.warn('Unable to find metadata for episode "' + id + '"');
            return null;
        }

        // Construct metadata
        return Parser._constructEpisode(
            episode,
            season,
            show
        );
    }

    // endregion

    // region Private methods

    static _constructMovie(movie) {
        return new Movie(
            Plugin,
            movie.id,
            movie.title,
            movie.year,
            movie.runtime * 1000
        );
    }

    static _constructShow(show) {
        return new Show(
            Plugin,
            show.id,
            show.title
        );
    }

    static _constructSeason(season, show) {
        return new Season(
            Plugin,
            season.id,
            season.title,
            season.year,
            season.seq,

            Parser._constructShow(show)
        );
    }

    static _constructEpisode(episode, season, show) {
        return new Episode(
            Plugin,
            episode.id,
            episode.title,
            episode.seq,
            episode.runtime * 1000,

            Parser._constructShow(show),
            Parser._constructSeason(season, show)
        );
    }

    // endregion
}
