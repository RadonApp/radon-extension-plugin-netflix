import SyncService from 'eon.extension.framework/base/services/source/sync';
import Registry from 'eon.extension.framework/core/registry';

import Plugin from '../../core/plugin';


export class NetflixSyncService extends SyncService {
    constructor() {
        super(Plugin);
    }
}

// Register service
Registry.registerService(new NetflixSyncService());
