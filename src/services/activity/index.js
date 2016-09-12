import {Resources} from 'eon.extension.browser';

import ActivityService from 'eon.extension.framework/base/services/source/activity';
import Bus from 'eon.extension.framework/core/bus';
import Registry from 'eon.extension.framework/core/registry';
import Session, {SessionState} from 'eon.extension.framework/models/activity/session';
import {Movie, Show, Season, Episode} from 'eon.extension.framework/models/metadata/video';

import MetadataApi from '../../api/metadata';
import Plugin from '../../core/plugin';
import ShimApi from '../../api/shim';
import Monitor from './monitor';


export class NetflixActivityService extends ActivityService {
    constructor() {
        super(Plugin);

        this.session = null;
        this.video = null;

        this._nextSessionKey = 0;

        // Configure event bus
        Bus.configure('service/activity');

        // Initialize activity monitor
        this.monitor = new Monitor(this);
        this.monitor.player.on('open', (videoId) => this._onOpen(videoId));
        this.monitor.player.on('playing', () => this._onPlaying());
        this.monitor.player.on('paused', () => this._onPaused());
        this.monitor.player.on('ended', () => this._onEnded());

        this.monitor.player.on('progress', (progress, time, duration) =>
            this._onProgress(progress, time, duration)
        );
    }

    initialize() {
        // Inject netflix shim
        this.inject().then(() => {
            // Bind activity monitor to document
            this.monitor.bind(document);
        }, (error) => {
            console.error('Unable to inject shim', error);
        });
    }

    inject() {
        var self = this;

        return new Promise((resolve, reject) => {
            var url = Resources.getUrl('source.netflix.shim/source.netflix.shim.js');

            // Create script element
            var script = document.createElement('script');
            script.src = url;
            script.onload = function() {
                this.remove();
            };

            // Bind shim api to page
            ShimApi.bind(document);

            // Wait for "ready" event
            ShimApi.once('ready', () => {
                resolve();
            });

            // TODO implement timeout?

            // Insert element into page
            (document.head || document.documentElement)
                .appendChild(script);
        });
    }

    // region Event handlers

    _onOpen(videoId) {
        console.log('_onOpen()', videoId);

        this._createSession(videoId);
    }

    _onPlaying() {
        console.log('_onPlaying()');
    }

    _onProgress(progress, time, duration) {
        console.log('_onProgress()', {
            progress: progress,
            time: time,
            duration: duration
        });

        if(this.session === null) {
            console.log('Unable to process "progress" event, no active sessions');
            return;
        }

        if(this.session.time !== null) {
            // Update activity state
            if (time > this.session.time) {
                this.session.state = SessionState.playing;
            } else if (time <= this.session.time) {
                this.session.state = SessionState.paused;
            }

            // Emit event
            this.emit('progress', this.session);
        }

        // Add new sample
        this.session.samples.push(time);
    }

    _onPaused() {
        console.log('_onPaused()');
    }

    _onEnded() {
        console.log('_onEnded()');
    }

    _onShimEvent(e) {
        console.log('_onShimEvent', e);
    }

    // endregion

    _createSession(videoId) {
        console.log("Creating session for video \"" + videoId + "\"");

        // Cast `videoId` to an integer
        videoId = parseInt(videoId);

        // Reset state
        this.video = null;
        this.session = null;

        // Retrieve video metadata
        MetadataApi.get(videoId).then((metadata) => {
            console.log('metadata:', metadata);

            // Construct metadata object
            this.video = this._parseMetadata(videoId, metadata);

            if(this.video === null) {
                console.warn('Unable to parse metadata:', metadata);
                return;
            }

            // Construct session
            this.session = new Session(
                this.plugin,
                this._nextSessionKey++,
                this.video,
                SessionState.LOADING
            );
        });
    }

    _parseMetadata(videoId, metadata) {
        var video = metadata.video;

        if(video.type === 'show') {
            return this._parseShowMetadata(videoId, video);
        }

        console.warn('Unknown metadata type: "' + video.type + '"');
        return null;
    }

    _parseMovieMetadata(videoId, item) {

    }

    _parseShowMetadata(videoId, show) {
        var season, episode;
        var match = false;

        // Iterate over seasons
        for(var i = 0; i < show.seasons.length; ++i) {
            season = show.seasons[i];

            // Iterate over season episodes for match
            for(var j = 0; j < season.episodes.length; ++j) {
                episode = season.episodes[j];

                if(episode.id === videoId) {
                    match = true;
                    break;
                }
            }

            if(match) {
                break;
            }
        }

        if(!match) {
            console.warn('Unable to find metadata for episode "' + videoId + '"');
            return null;
        }

        // Construct metadata
        return new Episode(
            this.plugin,
            videoId,
            episode.title,
            episode.seq,
            episode.runtime * 1000,

            new Show(
                this.plugin,
                show.id,
                show.title
            ),
            new Season(
                this.plugin,
                season.id,
                season.title,
                season.seq,

                new Show(
                    this.plugin,
                    show.id,
                    show.title
                )
            )
        )
    }
}

// Register service
Registry.registerService(new NetflixActivityService());
