import EventEmitter from 'eventemitter3';


export default class PlayerMonitor extends EventEmitter {
    constructor(main) {
        super();

        this.main = main;
        this.service = main.service;
        this.plugin = main.service.plugin;

        this.$video = null;
        this.video = null;

        // Construct mutation observer
        this.observer = new MutationObserver(
            (mutations) => this._onMutations(mutations)
        );

        // Bind to application events
        this.main.application.on('navigate.from', (path) => this._onNavigateFrom(path));
        this.main.application.on('navigate.to', (path) => this._onNavigateTo(path));
    }

    dispose() {
        // Disconnect mutation observer
        this.observer.disconnect();
        this.observer = null;

        // Unbind player events
        this._unbind();
    }

    // region Video player events

    _bind(video) {
        // Update state
        this.$video = $(video);
        this.video = video;

        // Bind player events
        this.$video.bind('playing',     () => this.emit('playing'));
        this.$video.bind('pause',       () => this.emit('paused'));
        this.$video.bind('ended',       () => this.emit('ended'));

        this.$video.bind('timeupdate',  () => {
            var time = this._getPlayerTime();
            var duration = this._getPlayerDuration();

            this.emit(
                'progress',
                this._calculateProgress(time, duration),
                time,
                duration
            );
        });
    }

    _unbind() {
        // Unbind player events
        if(this.video !== null) {
            this.$video.unbind('playing');
            this.$video.unbind('timeupdate');
            this.$video.unbind('pause');
            this.$video.unbind('ended');
        }

        // Reset state
        this.$video = null;
        this.video = null;
    }

    // endregion

    // region Event handlers

    _onMutations(mutations) {
        for(var i = 0; i < mutations.length; ++i) {
            this._onMutation(mutations[i]);
        }
    }

    _onMutation(mutation) {
        if(mutation.type === 'childList') {
            this._onMutationActions('add', mutation.addedNodes);
            this._onMutationActions('remove', mutation.removedNodes);
        }
    }

    _onMutationActions(action, nodes) {
        for(var i = 0; i < nodes.length; ++i) {
            var node = nodes[i];

            if(node.tagName !== 'VIDEO') {
                return;
            }

            this._onVideoMutationAction(action, node);
        }
    }

    _onVideoMutationAction(action, node) {
        if(action === "add") {
            this._bind(node);
        } else if(action === "remove") {
            this._unbind();
        }
    }

    _onNavigateFrom(path) {
        if(!path.startsWith('/watch')) {
            return;
        }

        // Dispose player monitor
        this.dispose();
    }

    _onNavigateTo(path) {
        if(!path.startsWith('/watch')) {
            return;
        }

        // Retrieve video key
        var videoId = path.substring(path.lastIndexOf('/') + 1);

        if(!videoId || videoId.length < 1) {
            return;
        }

        // Emit "open" event
        this.emit('open', parseInt(videoId));

        // Observe player changes
        this.observer.observe(this.main.appMountPoint, {
            childList: true,
            subtree: true
        });
    }

    // endregion

    // region Helpers

    _round2(num) {
        return +(Math.round(num + "e+2") + "e-2");
    }

    _getPlayerDuration() {
        if(this.video === null || this.video.duration === 0) {
            return null;
        }

        return this.video.duration;
    }

    _getPlayerTime() {
        if(this.video === null || this.video.duration === 0) {
            return null;
        }

        return this.video.currentTime;
    }

    _calculateProgress(time, duration) {
        return this._round2((parseFloat(time) / duration) * 100);
    }

    // endregion
}
