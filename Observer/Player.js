/* eslint-disable no-multi-spaces, key-spacing */
import Debounce from 'lodash-es/debounce';
import Filter from 'lodash-es/filter';
import IsEqual from 'lodash-es/isEqual';
import IsNil from 'lodash-es/isNil';
import IsString from 'lodash-es/isString';
import Map from 'lodash-es/map';

import ApplicationObserver from './Application';
import Log from '../Core/Logger';
import Observer from './Base';
import VideoObserver from './Video';


export class PlayerObserver extends Observer {
    constructor() {
        super();

        // Create debounced `onMediaChanged` function
        this.onMediaChanged = Debounce(this._onMediaChanged.bind(this), 5000);

        // Elements
        this.player = null;
        this.controls = null;
        this.info = null;

        // Text Elements
        this.title = null;
        this.subtitle = null;

        // Private attributes
        this._currentMedia = null;
        this._currentVideo = null;

        // Create video observer
        this._videoObserver = new VideoObserver();

        this._videoObserver.on('loading',   this.emit.bind(this, 'loading'));
        this._videoObserver.on('loaded',    this.emit.bind(this, 'loaded'));

        this._videoObserver.on('started',   this.emit.bind(this, 'started'));
        this._videoObserver.on('paused',    this.emit.bind(this, 'paused'));
        this._videoObserver.on('stopped',   this.emit.bind(this, 'stopped'));

        this._videoObserver.on('progress',  this.emit.bind(this, 'progress'));
        this._videoObserver.on('seeked',    this.emit.bind(this, 'seeked'));
    }

    create() {
        // Ensure application observer has been started
        ApplicationObserver.start();

        // Observe container
        this.container = this.observe(ApplicationObserver.mount, '.sizing-wrapper .AkiraPlayer');

        // Observe player
        this.player = this.observe(this.container, '.nfp:not(.preplay)');
        this.controls = this.observe(this.player, '.controls');
        this.info = this.observe(this.controls, '.video-title');

        // Observe video
        this.video = this.observe(this.player, '.VideoContainer div video')
            .on('added', this.onVideoAdded.bind(this))
            .on('removed', this.onVideoRemoved.bind(this));

        // Observe title
        this.title = this.observe(this.info, 'h4', { text: true })
            .on('mutation', this.onMediaChanged.bind(this));

        // Observe subtitle
        this.subtitle = this.observe(this.info, 'div span', { text: true })
            .on('mutation', this.onMediaChanged.bind(this));
    }

    observeVideo() {
        if(IsNil(this._currentVideo)) {
            Log.debug('Deferring video observations, no video available');
            return;
        }

        // Start observing video
        this._videoObserver.start(this._currentVideo);
    }

    getDuration() {
        if(IsNil(this._videoObserver)) {
            return null;
        }

        return this._videoObserver.getDuration();
    }

    // region Event Handlers

    onVideoAdded({ node }) {
        Log.trace('Video added: %o', node);

        // Stop existing session
        if(!IsNil(this._currentVideo) && this._currentVideo !== node) {
            Log.trace('Video already being observed, emitting remove event');

            // Stop observing existing video
            this.onVideoRemoved({ node: this._currentVideo });
        }

        // Update state
        this._currentVideo = node;

        // Emit changed event
        this.onMediaChanged();
    }

    onVideoRemoved({ node }) {
        Log.trace('Video removed: %o', node);

        // Stop video observations
        if(!this._videoObserver.stop(node)) {
            Log.trace('Ignoring video removed event (video isn\'t being observed)');
            return;
        }

        // Reset state
        this._currentMedia = null;
        this._currentVideo = null;

        // Emit "closed" event
        this.emit('closed');
    }

    _onMediaChanged() {
        let current = this._createMedia(
            this.title.first(),
            this.subtitle.all()
        );

        Log.trace('Media detected: %o', current);

        // Ensure media has changed
        if(IsEqual(this._currentMedia, current)) {
            return;
        }

        // Store current media
        let previous = this._currentMedia;

        // Update current media
        this._currentMedia = current;

        // Emit "media.changed" event
        this.emit('media.changed', { previous, current });

        // Log media change
        Log.trace('Media changed to %o', current);

        // Stop observing video
        if(IsNil(current)) {
            this.onVideoRemoved({ node: this._currentVideo });
            return;
        }

        // Start observing video
        this.observeVideo();

        // Emit "opened" event
        this.emit('opened');
    }

    // endregion

    // region Private Methods

    _createMedia($title, $subtitles) {
        let title = ($title && $title.innerText) || null;

        // Ensure title exists
        if(IsNil(title) || !IsString(title) || title.length <= 0) {
            Log.debug('Unable to detect media, no title defined (%o)', title);
            return null;
        }

        // Parse subtitles
        let subtitles = Filter(Map($subtitles, (node) =>
            node.innerText || null
        ), (value) =>
            !IsNil(value)
        );

        // Create movie (no identifier exists)
        if(subtitles.length < 1) {
            return this._createMovie(title);
        }

        // Create episode
        return this._createEpisode(title, ...subtitles);
    }

    _createMovie(title) {
        return {
            type: 'movie',

            // Metadata
            title
        };
    }

    _createEpisode(show, identifier) {
        let { season, number } = this._parseEpisodeIdentifier(identifier);

        if(IsNil(season) || IsNil(number)) {
            Log.debug('Unable to detect media, no identifier found (%o)', identifier);
            return null;
        }

        return {
            type: 'episode',

            // Metadata
            number,

            // Children
            season: this._createSeason(show, season)
        };
    }

    _createSeason(show, number) {
        return {
            type: 'season',

            // Metadata
            number,

            // Children
            show: this._createShow(show)
        };
    }

    _createShow(title) {
        return {
            type: 'show',

            // Metadata
            title
        };
    }

    _parseEpisodeIdentifier(identifier) {
        let match = /^[a-z]+(?:.\s?)?(\d+)(?:\s?:\s?)[a-z]+(?:.\s?)?(\d+)$/gi.exec(identifier);

        if(IsNil(match)) {
            return {
                season: null,
                number: null
            };
        }

        // Try parse numbers
        try {
            return {
                season: parseInt(match[1], 10),
                number: parseInt(match[2], 10)
            };
        } catch(e) {
            Log.warn('Unable to parse episode number: %o', identifier);

            return {
                season: null,
                number: null
            };
        }
    }

    _stringExists(value) {
        if(IsNil(value)) {
            return false;
        }

        if(!IsString(value)) {
            return false;
        }

        return value.length > 0;
    }

    // endregion
}

export default new PlayerObserver();
