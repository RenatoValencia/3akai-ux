/*!
 * Copyright 2013 Sakai Foundation (SF) Licensed under the
 * Educational Community License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 *     http://www.osedu.org/licenses/ECL-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

require(['jquery', 'underscore', 'oae.core'], function($, _, oae) {

    // Get the content id from the URL. The expected URL is `/content/<tenantId>/<resourceId>`.
    // The content id will then be `c:<tenantId>:<resourceId>`
    var contentId = 'c:' + $.url().segment(2) + ':' + $.url().segment(3);

    // Variable used to cache the requested content profile
    var contentProfile = null;

    /**
     * Renders the content preview.
     */
    var setUpContentProfilePreview = function() {
        // Remove the old preview widget
        $('#content-preview-container').html('');
        // Insert a new preview widget and pass in the updated content profile data
        oae.api.widget.insertWidget('contentpreview', null, $('#content-preview-container'), null, contentProfile);
    };

    /**
     * Get the content's basic profile and set up the screen. If the content
     * can't be found or is private to the current user, the appropriate
     * error page will be shown
     */
    var getContentProfile = function() {
        oae.api.content.getContent(contentId, function(err, profile) {
            if (err) {
                if (err.code === 401) {
                    oae.api.util.redirect().accessdenied();
                } else {
                    oae.api.util.redirect().notfound();
                }
                return;
            }

            // Cache the content profile data
            contentProfile = profile;
            // Set the browser title
            oae.api.util.setBrowserTitle(contentProfile.displayName);
            // Render the entity information
            setUpClip();
            // Show the content preview
            setUpContentProfilePreview();
            // Set up the context event exchange
            setUpContext();
            // We can now unhide the page
            oae.api.util.showPage();
        });
    };

    /**
     * Refresh the content's basic profile and update widgets that need the updated information.
     *
     * @param  {Object}         ev                      jQuery event object
     * @param  {Content}        updatedContent          Content profile of the updated content item
     */
    var refreshContentProfile = function(ev, updatedContent) {
        // Cache the content profile data
        contentProfile = updatedContent;
        // Re-render the entity information
        setUpClip();
        // Show the content preview
        setUpContentProfilePreview();
    };

    /**
     * The `oae.context.get` or `oae.context.get.<widgetname>` event can be sent by widgets
     * to get hold of the current context (i.e. content profile). In the first case, a
     * `oae.context.send` event will be sent out as a broadcast to all widgets listening
     * for the context event. In the second case, a `oae.context.send.<widgetname>` event
     * will be sent out and will only be caught by that particular widget. In case the widget
     * has put in its context request before the profile was loaded, we also broadcast it out straight away.
     */
    var setUpContext = function() {
        $(document).on('oae.context.get', function(ev, widgetId) {
            if (widgetId) {
                $(document).trigger('oae.context.send.' + widgetId, contentProfile);
            } else {
                $(document).trigger('oae.context.send', contentProfile);
            }
        });
        $(document).trigger('oae.context.send', contentProfile);
    };

    // Catches the `upload new version complete` event and refreshes the content profile
    $(document).on('oae.uploadnewversion.complete', refreshContentProfile);

    /**
     * Re-render the group's clip when the permissions have been updated.
     */
    $(document).on('done.manageaccess.oae', function(ev) {
        setUpClip();
    });

    /**
     * Returns the correct messages for the manage access widget based on
     * the resourceSubType of the content.
     */
    var getManageAccessMessages = function() {
        // Keeps track of messages to return
        var messages = {
            'members': oae.api.i18n.translate('__MSG__SHARE_WITH__'),
            'private': oae.api.i18n.translate('__MSG__PRIVATE__'),
            'loggedin': oae.api.util.security().encodeForHTML(contentProfile.tenant.displayName),
            'public': oae.api.i18n.translate('__MSG__PUBLIC__')
        };

        switch (contentProfile.resourceSubType) {
            case 'file':
                return _.extend(messages, {
                    'accessnotupdated': oae.api.i18n.translate('__MSG__FILE_ACCESS_NOT_UPDATED__'),
                    'accesscouldnotbeupdated': oae.api.i18n.translate('__MSG__FILE_ACCESS_COULD_NOT_BE_UPDATED__'),
                    'accesssuccessfullyupdated': oae.api.i18n.translate('__MSG__FILE_ACCESS_SUCCESSFULLY_UPDATED__'),
                    'accessupdated': oae.api.i18n.translate('__MSG__FILE_ACCESS_UPDATED__'),
                    'privatedescription': oae.api.i18n.translate('__MSG__FILE_PRIVATE_DESCRIPTION__'),
                    'loggedindescription': oae.api.i18n.translate('__MSG__FILE_LOGGEDIN_DESCRIPTION__').replace('${tenant}', oae.api.util.security().encodeForHTML(contentProfile.tenant.displayName)),
                    'publicdescription': oae.api.i18n.translate('__MSG__FILE_PUBLIC_DESCRIPTION__')
                });
            case 'link':
                return _.extend(messages, {
                    'accessnotupdated': oae.api.i18n.translate('__MSG__LINK_ACCESS_NOT_UPDATED__'),
                    'accesscouldnotbeupdated': oae.api.i18n.translate('__MSG__LINK_ACCESS_COULD_NOT_BE_UPDATED__'),
                    'accesssuccessfullyupdated': oae.api.i18n.translate('__MSG__LINK_ACCESS_SUCCESSFULLY_UPDATED__'),
                    'accessupdated': oae.api.i18n.translate('__MSG__LINK_ACCESS_UPDATED__'),
                    'privatedescription': oae.api.i18n.translate('__MSG__LINK_PRIVATE_DESCRIPTION__'),
                    'loggedindescription': oae.api.i18n.translate('__MSG__LINK_LOGGEDIN_DESCRIPTION__').replace('${tenant}', oae.api.util.security().encodeForHTML(contentProfile.tenant.displayName)),
                    'publicdescription': oae.api.i18n.translate('__MSG__LINK_PUBLIC_DESCRIPTION__')
                });
            case 'collabdoc':
                return _.extend(messages, {
                    'accessnotupdated': oae.api.i18n.translate('__MSG__DOCUMENT_ACCESS_NOT_UPDATED__'),
                    'accesscouldnotbeupdated': oae.api.i18n.translate('__MSG__DOCUMENT_ACCESS_COULD_NOT_BE_UPDATED__'),
                    'accesssuccessfullyupdated': oae.api.i18n.translate('__MSG__DOCUMENT_ACCESS_SUCCESSFULLY_UPDATED__'),
                    'accessupdated': oae.api.i18n.translate('__MSG__DOCUMENT_ACCESS_UPDATED__'),
                    'privatedescription': oae.api.i18n.translate('__MSG__DOCUMENT_PRIVATE_DESCRIPTION__'),
                    'loggedindescription': oae.api.i18n.translate('__MSG__DOCUMENT_LOGGEDIN_DESCRIPTION__').replace('${tenant}', oae.api.util.security().encodeForHTML(contentProfile.tenant.displayName)),
                    'publicdescription': oae.api.i18n.translate('__MSG__DOCUMENT_PUBLIC_DESCRIPTION__')
                });
        }
    };

    /**
     * Creates the widgetData object to send to the manageaccess widget that contains all
     * variable values needed by the widget.
     *
     * @return  {Object}    The widgetData to be passed into the manageaccess widget
     * @see  manageaccess#initManageAccess
     */
    var getManageAccessData = function() {
        return {
            'api': {
                'getMembersURL': '/api/content/'+ contentProfile.id + '/members',
                'setMembers': oae.api.content.updateMembers,
                'setVisibility': oae.api.content.updateContent
            },
            'contextProfile': contentProfile,
            'messages': getManageAccessMessages(),
            'roles': {
                'viewer': oae.api.i18n.translate('__MSG__CAN_VIEW__'),
                'manager': oae.api.i18n.translate('__MSG__CAN_MANAGE__')
            }
        };
    };

    /*!
     * Triggers the manageaccess widget and passes in context data
     */
    $(document).on('click', '.content-trigger-manageaccess', function() {
        $(document).trigger('oae.trigger.manageaccess', getManageAccessData());
    });

    /**
     * Render the content's clip, containing the thumbnail, display name as well as the
     * content's admin options
     */
    var setUpClip = function() {
        oae.api.util.template().render($('#content-clip-template'), {'content': contentProfile}, $('#content-clip-container'));
    };

    getContentProfile();

});
