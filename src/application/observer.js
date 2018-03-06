import Log from '../core/logger';
import Observer from '../base/observer';


export class ApplicationObserver extends Observer {
    constructor() {
        super();

        this.body = null;
        this.app = null;

        this._currentPath = null;
    }

    create() {
        // Observe body
        this.body = this.observe(document, 'body');

        // Observe mount
        this.mount = this.observe(this.body, '#appMountPoint div[data-reactroot] div')
            .on('added', this.onNavigated.bind(this));

        // Observe page
        this.page = this.observe(this.mount, '.mainView div')
            .on('added', this.onNavigated.bind(this));
    }

    // region Event Handlers

    onNavigated() {
        let current = location.pathname;

        // Ensure path has changed
        if(this._currentPath === current) {
            return;
        }

        // Retrieve previous path
        let previous = this._currentPath;

        // Update current path
        this._currentPath = current;

        // Emit event
        this.emit('navigate', { previous, current });

        // Log navigation
        Log.debug('Navigated to %o (from %o)', current, previous);
    }

    // endregion
}

export default new ApplicationObserver();
