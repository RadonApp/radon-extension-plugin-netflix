import {
    EnableOption,
    SwitchOption,
    Group
} from 'eon.extension.framework/services/configuration/models';

import Plugin from '../../core/plugin';


export default [
    new EnableOption(Plugin, 'enabled', 'Enabled', {
        default: false
    }),

    new Group(Plugin, 'activity', 'Activity', [
        new EnableOption(Plugin, 'activity.enabled', 'Enabled', {
            default: true,
            requires: ['enabled']
        }),
    ]),

    new Group(Plugin, 'sync', 'Sync', [
        new EnableOption(Plugin, 'sync.enabled', 'Enabled', {
            default: true,
            requires: ['enabled']
        }),

        new SwitchOption(Plugin, 'sync.ratings', 'Synchronize ratings', {
            default: true,
            requires: ['sync.enabled']
        })
    ])
];
