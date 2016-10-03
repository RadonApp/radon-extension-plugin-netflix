import {Movie, Show, Season, Episode} from 'eon.extension.framework/models/metadata/video';

import Plugin from '../../../core/plugin';


export default class Parser {
    // region Public methods

    static parse(id, metadata) {
        let item = metadata.video;

        if(item.type === 'movie') {
            return Parser.parseMovie(id, item);
        } else if(item.type === 'show') {
            return Parser.parseEpisodeFromShow(id, item);
        }

        console.warn('Unknown metadata type: "' + item.type + '"');
        return null;
    }

    static parseMovie(id, movie) {
        return Parser._constructMovie(id, movie);
    }

    static parseEpisodeFromShow(id, show) {
        let season, episode;
        let match = false;

        // Iterate over seasons
        for(let i = 0; i < show.seasons.length; ++i) {
            season = show.seasons[i];

            // Iterate over season episodes for match
            for(let j = 0; j < season.episodes.length; ++j) {
                episode = season.episodes[j];

                if(episode.id === id) {
                    match = true;
                    break;
                }
            }

            if(match) {
                break;
            }
        }

        if(!match) {
            console.warn('Unable to find metadata for episode "' + id + '"');
            return null;
        }

        // Construct metadata
        return Parser._constructEpisode(
            id,
            episode,
            season,
            show
        );
    }

    // endregion

    // region Private methods

    static _constructMovie(id, movie) {
        return new Movie(
            Plugin,
            id,
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

    static _constructEpisode(id, episode, season, show) {
        return new Episode(
            Plugin,
            id,
            episode.title,
            episode.seq,
            episode.runtime * 1000,

            Parser._constructShow(show),
            Parser._constructSeason(season, show)
        );
    }

    // endregion
}
