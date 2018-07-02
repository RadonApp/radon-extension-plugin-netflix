/* eslint-disable no-multi-spaces, key-spacing */
import EventEmitter from 'eventemitter3';
import IsNil from 'lodash-es/isNil';

import {Movie, Show, Season, Episode} from 'neon-extension-framework/Models/Metadata/Video';

import ApplicationObserver from '../Observer/Application';
import Log from '../Core/Logger';
import Plugin from '../Core/Plugin';
import PlayerObserver from '../Observer/Player';


export default class PlayerMonitor extends EventEmitter {
    constructor() {
        super();

        // Private attributes
        this._currentId = null;
        this._currentMedia = null;
        this._currentItem = null;

        // Bind to application events
        ApplicationObserver.on('navigate',  this.onNavigated.bind(this));

        // Bind to player events
        PlayerObserver.on('media.changed',  this.onMediaChanged.bind(this));

        PlayerObserver.on('opened',         this.onOpened.bind(this));
        PlayerObserver.on('closed',         this.onClosed.bind(this));
        PlayerObserver.on('loaded',         this.onLoaded.bind(this));
        PlayerObserver.on('started',        this.onStarted.bind(this));

        PlayerObserver.on('paused',         this.emit.bind(this, 'paused'));
        PlayerObserver.on('stopped',        this.emit.bind(this, 'stopped'));

        PlayerObserver.on('progress',       this.emit.bind(this, 'progress'));
        PlayerObserver.on('seeked',         this.emit.bind(this, 'seeked'));
    }

    start() {
        // Start observing application
        ApplicationObserver.start();

        // Start observing player
        PlayerObserver.start();
    }

    reset() {
        Log.trace('PlayerMonitor.reset');

        // Reset state
        this._currentId = null;
        this._currentMedia = null;
        this._currentItem = null;
    }

    getDuration() {
        return PlayerObserver.getDuration();
    }

    // region Event Handlers

    onNavigated({ previous, current }) {
        Log.trace('PlayerMonitor.onNavigated: %o -> %o', previous, current);

        if(!IsNil(previous)) {
            // Close session
            this.onClosed();

            // Reset state
            this.reset();
        }

        // Update video identifier
        let match = /^\/watch\/(\d+)$/g.exec(current);

        if(!IsNil(match)) {
            this._currentId = parseInt(match[1], 10);
        } else {
            this._currentId = null;
        }
    }

    onOpened() {
        Log.trace('PlayerMonitor.onOpened');

        // Ensure item exists
        if(IsNil(this._currentItem)) {
            return;
        }

        // Emit "opened" event
        this.emit('opened', this._currentItem);
    }

    onLoaded() {
        Log.trace('PlayerMonitor.onLoaded');

        // Update item
        if(!this._updateItem()) {
            return;
        }

        // Emit "loaded" event
        this.emit('loaded', this._currentItem);
    }

    onStarted() {
        Log.trace('PlayerMonitor.onStarted');

        // Ensure item exists
        if(IsNil(this._currentItem)) {
            return;
        }

        // Emit "started" event
        this.emit('started');
    }

    onClosed() {
        Log.trace('PlayerMonitor.onClosed');

        if(IsNil(this._currentItem)) {
            return;
        }

        // Emit "closed" event
        this.emit('closed', this._currentItem);
    }

    onMediaChanged({ previous, current }) {
        Log.trace('PlayerMonitor.onMediaChanged: %o -> %o', previous, current);

        // Detect navigation change (to next video)
        ApplicationObserver.onNavigated();

        // Update state
        this._currentMedia = current;
    }

    // endregion

    // region Private Methods

    _updateItem() {
        let item = null;

        // Try construct track
        try {
            item = this._createItem();
        } catch(e) {
            Log.error('Unable to create track: %s', e.message || e);
        }

        // Ensure track exists
        if(IsNil(item)) {
            Log.warn('Unable to parse item', this._currentMedia);

            // Clear current item
            this._currentItem = null;

            return false;
        }

        // Ensure track has changed
        if(!IsNil(this._currentItem) && this._currentItem.matches(item)) {
            return false;
        }

        // Update current item
        this._currentItem = item;

        return true;
    }

    _createItem() {
        if(IsNil(this._currentId) || IsNil(this._currentMedia)) {
            return null;
        }

        // Create metadata
        let media = this._currentMedia;

        // - Movie
        if(media.type === 'movie') {
            return this._createMovie(this._currentId, media);
        }

        // - Episode
        if(media.type === 'episode') {
            return this._createEpisode(this._currentId, media);
        }

        // Unknown media type
        throw new Error(`Unknown media type: ${media.type}`);
    }

    _createMovie(id, { title }) {
        return Movie.create(Plugin.id, {
            keys: {
                id
            },

            // Metadata
            title
        });
    }

    _createEpisode(id, { number, season }) {
        return Episode.create(Plugin.id, {
            keys: {
                id
            },

            // Metadata
            number,

            // Children
            season: this._createSeason(season)
        });
    }

    _createSeason({ number, show }) {
        return Season.create(Plugin.id, {
            // Metadata
            number,

            // Children
            show: this._createShow(show)
        });
    }

    _createShow({ title }) {
        return Show.create(Plugin.id, {
            title
        });
    }

    // endregion
}
