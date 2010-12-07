/*
 * Licensed to the Sakai Foundation (SF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The SF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
/*global $, fluid, window */

var sakai = sakai || {};

sakai.content_profile = sakai.content_profile || {};
sakai.content_profile.content_data = sakai.content_profile.content_data || {};

sakai.content_profile = function(){

    var content_path = ""; // The current path of the content
    var ready_event_fired = 0;
    var list_event_fired = false;

    /**
     * Load the content profile for the current content path
     */
    sakai.content_profile.loadContentProfile = function(callback){
        // Check whether there is actually a content path in the URL

        // http://localhost:8080/p/YjsKgQ8wNtTga1qadZwjQCe.2.json
        // http://localhost:8080/p/YjsKgQ8wNtTga1qadZwjQCe.members.json
        // http://localhost:8080/var/search/pool/activityfeed.json?p=/p/YjsKgQ8wNtTga1qadZwjQCe&items=1000

        if (content_path) {

            // Get the content information, the members and managers and version information
            var batchRequests = [
                {
                    "url": content_path + ".2.json",
                    "method":"GET",
                    "cache":false,
                    "dataType":"json"
                },
                {
                    "url": content_path + ".members.json",
                    "method":"GET",
                    "cache":false,
                    "dataType":"json"
                },
                {
                    "url": content_path + ".versions.json",
                    "method":"GET",
                    "cache":false,
                    "dataType":"json"
                },
                {
                    "url": sakai.config.URL.POOLED_CONTENT_ACTIVITY_FEED + "?p=" + content_path,
                    "method":"GET",
                    "cache":false,
                    "dataType":"json"
                }
            ];

            var contentInfo = false;
            var contentMembers = false;
            var contentActivity = false;
            var versionInfo = false;

            // temporary request that returns data
            $.ajax({
                url: sakai.config.URL.POOLED_CONTENT_ACTIVITY_FEED + "?p=" + content_path  + "&items=1000",
                type: "GET",
                "async":false,
                "cache":false,
                "dataType":"json",
                success: function(data){
                    if (data.results.hasOwnProperty(0)) {
                        contentActivity = data;
                    }
                }
            });

            $.ajax({
                url: sakai.config.URL.BATCH,
                type: "POST",
                data: {
                    requests: $.toJSON(batchRequests)
                },
                success: function(data){

                    if (data.results.hasOwnProperty(0)) {
                        if (data.results[0].status === 404){
                            sakai.api.Security.send404();
                            return;
                        } else if (data.results[0].stats === 403){
                            sakai.api.Security.send403();
                            return;
                        } else {
                            contentInfo = $.parseJSON(data.results[0].body);
                        }
                    }

                    if (data.results.hasOwnProperty(1)) {
                        contentMembers = $.parseJSON(data.results[1].body);
                        contentMembers.viewers = contentMembers.viewers || {};
                        $.each(contentMembers.viewers, function(index, resultObject) {
                            contentMembers.viewers[index].picture = $.parseJSON(contentMembers.viewers[index].picture);
                        });
                        contentMembers.managers = contentMembers.managers || {};
                        $.each(contentMembers.managers, function(index, resultObject) {
                            contentMembers.managers[index].picture = $.parseJSON(contentMembers.managers[index].picture);
                        });
                    }

                    if (data.results.hasOwnProperty(2)) {
                        versionInfo =$.parseJSON(data.results[2].body)
                        var versions = [];
                        for (var i in versionInfo.versions) {
                            if(versionInfo.versions.hasOwnProperty(i)){
                                var splitDate = versionInfo.versions[i]["jcr:created"].split("T")[0].split("-");
                                versionInfo.versions[i]["jcr:created"] = sakai.api.l10n.transformDate(new Date(splitDate[0], splitDate[1]-1, splitDate[2]));
                                versions.push(versionInfo.versions[i]);
                            }
                        }
                        versionInfo.versions = versions.reverse();
                    }

                    if (data.results.hasOwnProperty(3)) {
                        //contentActivity = $.parseJSON(data.results[2].body);
                    }

                    var manager = false;
                    var anon = true;
                    if (!sakai.data.me.user.anon){
                        for (var i in contentMembers.managers) {
                            if (contentMembers.managers[i].userid === sakai.data.me.user.userid) {
                            	manager = true;
                            }
                        }
                    }

                    var directory = [];
                    // When only one tag is put in this will not be an array but a string
                    // We need an array to parse and display the results
                    if ((typeof(contentInfo["sakai:tags"]) !== "object") && contentInfo["sakai:tags"]){
                        contentInfo["sakai:tags"] = [contentInfo["sakai:tags"]];
                    }
                    currentTags = contentInfo["sakai:tags"];
                    $(contentInfo["sakai:tags"]).each(function(i){
                        var splitDir = contentInfo["sakai:tags"][i].split("/");
                        if (splitDir[0] === "directory") {
                            var item = [];
                            for (var j in splitDir) {
                                if (splitDir.hasOwnProperty(j)) {
                                    if (splitDir[j] !== "directory") {
                                        item.push(splitDir[j]);
                                    }
                                }
                            }
                            directory.push(item);
                        }
                    });

                    var fullPath = content_path; // + "/" + contentInfo["sakai:pooled-content-file-name"];
                    //if (contentInfo["sakai:pooled-content-file-name"].substring(contentInfo["sakai:pooled-content-file-name"].lastIndexOf("."), contentInfo["sakai:pooled-content-file-name"].length) !== contentInfo["sakai:fileextension"]) {
                    //    fullPath += contentInfo["sakai:fileextension"];
                    //}

                    // filter out the the everyone group and the anonymous user
                    contentMembers.viewers = $.grep(contentMembers.viewers, function(resultObject, index){
                        if (resultObject['groupid'] !== 'everyone' &&
                            resultObject['userid'] !== 'anonymous') {
                            return true;
                        }
                        return false;
                    });

                    json = {
                        data: contentInfo,
                        members: contentMembers,
                        activity: contentActivity,
                        mode: "content",
                        url: sakai.config.SakaiDomain + fullPath,
                        path: fullPath,
                        saveddirectory : directory,
                        versions : versionInfo,
                        anon: anon,
                        isManager: manager
                    };

                    sakai.content_profile.content_data = json;
                    $(window).trigger("sakai-contentprofile-ready");
                    if ($.isFunction(callback)) {
                        callback(true);
                    }
                }
            });

        } else {

            sakai.api.Security.send404();

        }

    };

    var handleHashChange = function() {
        content_path = $.bbq.getState("content_path") || "";
        sakai.content_profile.loadContentProfile(function() {
            // The request was successful so initialise the entity widget
            if (sakai.entity && sakai.entity.isReady) {
                sakai.api.UI.entity.render("content2", sakai.content_profile.content_data);
            }
            else {
                $(window).bind("sakai.api.UI.entity.ready", function(e){
                    sakai.api.UI.entity.render("content2", sakai.content_profile.content_data);
                    ready_event_fired++;
                });
            }
            // The request was successful so initialise the relatedcontent widget
            if (sakai.relatedcontent && sakai.relatedcontent.isReady) {
                sakai.api.UI.relatedcontent.render(sakai.content_profile.content_data);
            }
            else {
                $(window).bind("sakai.api.UI.relatedcontent.ready", function(e){
                    sakai.api.UI.relatedcontent.render(sakai.content_profile.content_data);
                    ready_event_fired++;
                });
            }
            //
            if (sakai.contentpreview && sakai.contentpreview.isReady) {
                $(window).trigger("sakai.contentpreview.start");
            }
            else {
                $(window).bind("sakai.contentpreview.ready", function(e){
                    $(window).trigger("sakai.contentpreview.start");
                    ready_event_fired++;
                });
            }

            sakai.api.Security.showPage();

            // rerender comments widget
            $(window).trigger("content_profile_hash_change");
        });
    };

    /**
     * addRemoveUsers users
     * Function that adds or removes selected users to/from the content
     * @param {String} tuid Identifier for the widget/type of user we're adding (viewer or manager)
     * @param {Object} users List of users we're adding/removing
     * @param {String} task Operation of either adding or removing
     * @param {Array} Array containg user ID's and names that can be displayed on the UI
     */
    var addRemoveUsers = function(tuid, users, task){
        var notificationType = sakai.api.Security.saneHTML($("#content_profile_viewers_text").text());
        var reqData = [];
        $.each(users.toAdd, function(index, user){
            var data = {
                ":viewer": user
            };
            if (tuid === 'managers' && task === 'add') {
                notificationType = sakai.api.Security.saneHTML($("#content_profile_managers_text").text());
                data = {
                    ":manager": user
                };
            }
            else
                if (task === 'remove') {
                    if (user['userid']) {
                        user = user['userid'];
                    }
                    else
                        if (user['sakai:group-id']) {
                            user = user['sakai:group-id'];
                        }
                        else
                            if (user['rep:userId']) {
                                user = user['rep:userId'];
                            }
                    data = {
                        ":viewer@Delete": user
                    };
                    if (tuid === 'managers') {
                        notificationType = sakai.api.Security.saneHTML($("#content_profile_managers_text").text());
                        data = {
                            ":manager@Delete": user
                        };
                    }
                }
            if (user) {
                reqData.push({
                    "url": content_path + ".members.json",
                    "method": "POST",
                    "parameters": data
                });
            }
        });

        if (reqData.length > 0) {
            // batch request to update user access for the content
            $.ajax({
                url: sakai.config.URL.BATCH,
                traditional: true,
                type: "POST",
                data: {
                    requests: $.toJSON(reqData)
                },
                success: function(data){
                    if (task === 'add') {
                        sakai.api.Util.notification.show(sakai.api.Security.saneHTML($("#content_profile_text").text()), sakai.api.Security.saneHTML($("#content_profile_users_added_text").text() + " " + notificationType) + ": " + users.toAddNames.toString().replace(/,/g, ", "));
                        sakai.content_profile.loadContentProfile();
                    }
                    else {
                        sakai.api.Util.notification.show(sakai.api.Security.saneHTML($("#content_profile_text").text()), sakai.api.Security.saneHTML($("#content_profile_users_removed_text").text() + " " + notificationType) + " " + users.toAddNames.toString().replace(/,/g, ", "));
                    }
                }
            });
        }
    };

    $(window).bind("sakai-pickeruser-finished", function(e, peopleList){
        if(!peopleList.mode || peopleList.mode == undefined){
            peopleList.mode = "viewers";
        }
        addRemoveUsers(peopleList.mode, peopleList, 'add');
    });
    ////////////////////
    // Initialisation //
    ////////////////////

    /**
     * Initialise the content profile page
     */
    var init = function(){
        // Bind an event to window.onhashchange that, when the history state changes,
        // loads all the information for the current resource
        $(window).bind('hashchange', function(){
            handleHashChange();
        });
        handleHashChange();
    };

    // Initialise the content profile page
    init();

};



































var old_function = function(){
    //////////////////////
    // Config variables //
    //////////////////////

    var content_path = ""; // The current path of the content
    var globalJSON;
    var ready_event_fired = 0;
    var list_event_fired = false;


    ///////////////////
    // CSS Selectors //
    ///////////////////

    var $content_profile_error_container = $("#content_profile_error_container");
    var $content_profile_error_container_template = $("#content_profile_error_container_template");


    //////////////////////////
    // Global functionality //
    //////////////////////////

    /**
     * Show a general error message to the user
     * @param {String} error
     * A key for an error message - we use the key and not the text for i18n
     */
    var showError = function(error){
        $.TemplateRenderer($content_profile_error_container_template, {"error": error}, $content_profile_error_container);
    };

    /**
     * Load the content profile for the current content path
     */
    sakai.content_profile.loadContentProfile = function(callback){
        // Check whether there is actually a content path in the URL
        if (content_path) {
            $.ajax({
                url: sakai.config.SakaiDomain + content_path + ".2.json",
                success: function(data){

                    var directory = [];
                    // When only one tag is put in this will not be an array but a string
                    // We need an array to parse and display the results
                    if ((typeof(data["sakai:tags"]) !== "object") && data["sakai:tags"]){
                        data["sakai:tags"] = [data["sakai:tags"]];
                    }
                    currentTags = data["sakai:tags"];
                    $(data["sakai:tags"]).each(function(i){
                        var splitDir = data["sakai:tags"][i].split("/");
                        if (splitDir[0] === "directory") {
                            var item = [];
                            for (var j in splitDir) {
                                if (splitDir.hasOwnProperty(j)) {
                                    if (splitDir[j] !== "directory") {
                                        item.push(splitDir[j]);
                                    }
                                }
                            }
                            directory.push(item);
                        }
                    });

                    json = {
                        data: data,
                        mode: "content",
                        url: sakai.config.SakaiDomain + content_path,
                        contentpath: content_path,
                        path: content_path,
                        saveddirectory : directory
                    };

                    sakai.content_profile.content_data = json;
                    $(window).trigger("sakai-contentprofile-ready");
                    if ($.isFunction(callback)) {
                        callback(true);
                    }
                },
                error: function(xhr, textStatus, thrownError){

                    if (xhr.status === 401 || xhr.status === 403){
                        sakai.api.Security.send403();
                    } else {
                        sakai.api.Security.send404();
                    }
                    if ($.isFunction(callback)) {
                        callback(false);
                    }

                }
            });

        } else {

            sakai.api.Security.send404();

        }

    };

    /**
     * Load the content authorizables who have access to the content
     */
    var loadContentUsers = function(tuid){
        // Check whether there is actually a content path in the URL
        if (content_path) {
            var pl_config = {"selectable":true, "subNameInfoUser": "", "subNameInfoGroup": "sakai:group-description", "sortOn": "lastName", "sortOrder": "ascending", "items": 1000 };
            var url = sakai.config.SakaiDomain + content_path + ".members.detailed.json";
            $("#content_profile_listpeople_container").show();
            $(window).trigger("sakai-listpeople-render", {"tuid": tuid, "listType": tuid, "pl_config": pl_config, "url": url, "id": content_path});
        }
    };

    /**
     * addRemoveUsers users
     * Function that adds or removes selected users to/from the content
     * @param {String} tuid Identifier for the widget/type of user we're adding (viewer or manager)
     * @param {Object} users List of users we're adding/removing
     * @param {String} task Operation of either adding or removing
     */
    var addRemoveUsers = function(tuid, users, task) {
        // disable buttons
        toggleButtons(tuid,true);
        var notificationType = sakai.api.Security.saneHTML($("#content_profile_viewers_text").text());
        if (sakai.data.listpeople[tuid].selectCount === sakai.data.listpeople[tuid].currentElementCount && tuid === "managers" && task === 'remove') {
            sakai.api.Util.notification.show(sakai.api.Security.saneHTML($("#content_profile_text").text()), sakai.api.Security.saneHTML($("#content_profile_cannot_remove_everyone").text()), sakai.api.Util.notification.type.ERROR);
        } else {
            var reqData = [];
            $.each(users, function(index, user) {
                var data = {
                    ":viewer": user
                };
                if (tuid === 'managers' && task === 'add') {
                    notificationType = sakai.api.Security.saneHTML($("#content_profile_managers_text").text());
                    data = {
                        ":manager": user
                    };
                } else if (task === 'remove') {
                    if (user['userid']) {
                        user = user['userid'];
                    } else if (user['sakai:group-id']) {
                        user = user['sakai:group-id'];
                    } else if (user['rep:userId']) {
                        user = user['rep:userId'];
                    }
                    data = {
                        ":viewer@Delete": user
                    };
                    if (tuid === 'managers') {
                        notificationType = sakai.api.Security.saneHTML($("#content_profile_managers_text").text());
                        data = {
                            ":manager@Delete": user
                        };
                    }
                }
                if (user) {
                    reqData.push({
                        "url": content_path + ".members.json",
                        "method": "POST",
                        "parameters": data
                    });
                }
            });

            if (reqData.length > 0) {
                // batch request to update user access for the content
                $.ajax({
                    url: sakai.config.URL.BATCH,
                    traditional: true,
                    type: "POST",
                    data: {
                        requests: $.toJSON(reqData)
                    },
                    success: function(data){
                        loadContentUsers("viewers");
                        loadContentUsers("managers");
                        if (task === 'add') {
                            sakai.api.Util.notification.show(sakai.api.Security.saneHTML($("#content_profile_text").text()), sakai.api.Security.saneHTML($("#content_profile_users_added_text").text() + " " + notificationType));
                        } else {
                            sakai.api.Util.notification.show(sakai.api.Security.saneHTML($("#content_profile_text").text()), sakai.api.Security.saneHTML($("#content_profile_users_removed_text").text() + " " + notificationType));
                        }
                        $("#content_profile_add_" + tuid).focus();
                    }
                });
            }
        }
    };

    /**
     * Enable/disable buttons based on the selected list.
     */
    var toggleButtons = function(tuid,isDisable) {
        // if disable is true
        if (!isDisable) {
            // if there is selected list
            if (sakai.data.listpeople[tuid].selectCount) {
                // enable the button
                $("#content_profile_remove_" + tuid).removeAttr("disabled");
            }
            // if there is not selected list disable
            else {
                $("#content_profile_remove_" + tuid).attr("disabled", "disabled");
            }
        }
        // disable the button
        else {
            $("#content_profile_remove_" + tuid).attr("disabled", "disabled");
        }
    };

    ///////////////////////
    // BINDING FUNCTIONS //
    ///////////////////////

    /**
     * Add binding to list elements on the page
     */
    var addListBinding = function(){
        if (sakai.listpeople && sakai.listpeople.isReady) {
            loadContentUsers("viewers");
            loadContentUsers("managers");
        } else {
            $(window).bind("sakai-listpeople-ready", function(e, tuid){
                loadContentUsers(tuid);
            });
        }

        // Bind event when selection in the list change
        $(window).bind("list-people-selected-change", function(e, tuid){
            toggleButtons(tuid);
        });

        // Bind the remove viewers button
        $("#content_profile_remove_viewers").bind("click", function(){
            addRemoveUsers('viewers', sakai.data.listpeople["viewers"]["selected"], 'remove');
        });

        // Bind the remove managers button
        $("#content_profile_remove_managers").bind("click", function(){
            addRemoveUsers('managers', sakai.data.listpeople["managers"]["selected"], 'remove');
        });

        if (sakai.pickeruser && sakai.pickeruser.isReady) {
            doPickerUserBindings();
        } else {
            // Add binding to the pickeruser widget buttons for adding users
            $(window).bind("sakai-pickeruser-ready", function(e){
                doPickerUserBindings();
            });
        }
    };

    var doPickerUserBindings = function() {
        var pl_config = {
            "mode": "search",
            "selectable":true,
            "subNameInfo": "email",
            "sortOn": "lastName",
            "items": 50,
            "type": "people",
            "what": "Viewers",
            "where": sakai.content_profile.content_data.data["sakai:pooled-content-file-name"],
            "URL": sakai.content_profile.content_data.url + "/" + sakai.content_profile.content_data.data["sakai:pooled-content-file-name"]
        };

        // Bind the add viewers button
        $("#content_profile_add_viewers").bind("click", function(){
            pl_config.what = "Viewers";
            $(window).trigger("sakai-pickeruser-init", pl_config, function(people) {
            });
            $(window).unbind("sakai-pickeruser-finished");
            $(window).bind("sakai-pickeruser-finished", function(e, peopleList) {
                addRemoveUsers('viewers', peopleList.toAdd, 'add');
            });
        });

        // Bind the add managers button
        $("#content_profile_add_managers").bind("click", function(){
            pl_config.what = "Managers";
            $(window).trigger("sakai-pickeruser-init", pl_config, function(people) {
            });
            $(window).unbind("sakai-pickeruser-finished");
            $(window).bind("sakai-pickeruser-finished", function(e, peopleList) {
                addRemoveUsers('managers', peopleList.toAdd, 'add');
            });
        });
    };

    var handleHashChange = function() {
        content_path = $.bbq.getState("content_path") || "";
        sakai.content_profile.loadContentProfile(function() {
            // The request was successful so initialise the entity widget
            if (sakai.entity && sakai.entity.isReady) {
                sakai.api.UI.entity.render("content", sakai.content_profile.content_data);
            }
            else {
                $(window).bind("sakai.api.UI.entity.ready", function(e){
                    sakai.api.UI.entity.render("content", sakai.content_profile.content_data);
                    ready_event_fired++;
                });
            }

            if (!list_event_fired) {
                // add binding to listpeople widget and buttons
                addListBinding();
                list_event_fired = true;
            } else {
                loadContentUsers("viewers");
                loadContentUsers("managers");
            }
            sakai.api.Security.showPage();

        });
    };

    ////////////////////
    // Initialisation //
    ////////////////////

    /**
     * Initialise the content profile page
     */
    var init = function(){
        // Bind an event to window.onhashchange that, when the history state changes,
        // loads all the information for the current resource
        $(window).bind('hashchange', function(){
            handleHashChange();
        });
        handleHashChange();
    };

    // Initialise the content profile page
    init();
}

sakai.api.Widgets.Container.registerForLoad("sakai.content_profile");