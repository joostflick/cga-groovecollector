// ==UserScript==
// @name         Bandcamp Download Collection
// @namespace    https://bandcamp.com
// @version      1.4
// @description  Opens the download page for each item in your collection.
// @author       Joost Flick
// @match        https://bandcamp.com/flickflick
// @match        https://bandcamp.com/roycer
// @match        https://bandcamp.com/tomasdevries
// @grant        GM_openInTab
// ==/UserScript==

// Ignore albums with the same title and artist
var ignoreDuplicateTitles = true;

var throttleDownloads = false;

var throttleDownloadInterval = 5;

(function () {
    'use strict';

    // https://github.com/WebReflection/ustyler v1.0.1 | SPDX-License-Identifier(ISC) | Copyright (c) 2020, Andrea Giammarchi, @WebReflection
    function css(template) {
        const text = typeof template == 'string' ? [template] : [template[0]];
        for (let i = 1, {length} = arguments; i < length; i++)
            text.push(arguments[i], template[i]);
        const style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(text.join('')));
        return document.head.appendChild(style);
    }
    // end(ustyler)

    // SPDX-License-Identifier(0BSD) | Copyright 2018, 2020 bb010g
    var EventHandler = {handleEvent(event) { this['on' + event.type](event); }};
    function createEventHandler(handler) {
        if (!EventHandler.isPrototypeOf(handler)) { handler = Object.create(EventHandler, handler); }
        return handler;
    }
    function addEventHandler(target, handler) {
        for (const type of Object.getOwnPropertyNames(handler)) {
            if (/^on/.test(type)) { target.addEventListener(type.slice(2), handler); }
        }
        target.eventHandler = handler;
    }
    function element(tagName, props = {}, children = [], eventHandler = {}) {
        const el = document.createElement(tagName);
        Object.assign(el, props);
        el.append(...children);
        addEventHandler(el, createEventHandler(eventHandler));
        return el;
    }
    // end

    function newMouseEvent(type, view) { return new MouseEvent(type, {bubbles: true, cancelable: true, view: view}); }

    var style = css`
        #bandcamp-greasy {
            background-color: #1DA0C3;
            position: fixed;
            color: white;
            top: 0;
            left: 0;
            right: 0;
            padding: 20px;
            z-index: 9999999;
            max-height: 75vh;
            box-sizing: border-box;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
        }
        #bandcamp-greasy a { color: inherit; }
        #bandcamp-greasy li { margin-top: unset; margin-bottom: unset; }
        #bandcamp-greasy > * {
            display: grid;
            grid-template-columns: auto fit-content(30em);
            grid-auto-rows: fit-content(50vh);
        }
        #bandcamp-greasy > * > * { grid-column: 1; overflow-y: auto; }
        #bandcamp-greasy > * > .controls { grid-column: 2; overflow-y: unset; }
        #bandcamp-greasy h2 { text-transform: uppercase; }
        #bandcamp-greasy > .status {
            font-weight: bold;
        }
        #bandcamp-greasy .controls {
            color: white;
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
            align-content: center;
            justify-content: flex-end;
        }
        #bandcamp-greasy .controls > button, #bandcamp-greasy .controls > input::placeholder:first-letter {
            text-transform: uppercase;
        }
        #bandcamp-greasy .controls > * {
            display: block;
            margin-bottom: 10px;
            margin-right: 5px;
        }
        #bandcamp-greasy .album-infos .album-info input[type="checkbox"]:disabled ~ .item {
            text-decoration: line-through;
        }
        .download-all, .download-selected {
            font-size: 18px;
            color: rebeccapurple;
        }
        .duplicate {
            color: red;
        }
    `;

    var mainContainer = element('div', {id: 'bandcamp-greasy'}, [
        element('div', {className: 'header'}, [
            element('h2', {innerHTML: `GROOVATRON CGA DOWNLOADER`}),

            element('div', {className: 'controls'}, [
                element('button', {className: 'retry-pagination', textContent: "Refresh"}, [], {onclick: {value() {
                            var collectionGrid = window.CollectionGrids.collection;
                            if (collectionGrid.paginating) {
                                return;
                            }
                            if (collectionGrid.error) {
                                collectionGrid.error = false;
                            }
                            collectionGrid.paginate();
                        }}}),
                element('button', {className: 'close', textContent: "Close"}, [], {onclick: {value() {
                            hideMainContainer();
                        }}}),
            ]),
        ]),
        element('div', {className: 'albums'}, [
            element('span', {className: 'status', textContent: "Quite empty here."}),
            element('div', {className: 'controls'}, [
                element('button', {className: 'scan-albums', textContent: "Scan albums on current page"}, [], {onclick: {value(e) {
                            if (e.target.disabled) { return; }
                            e.target.disabled = true;
                            var albumInfos = e.target.parentNode.parentNode.querySelector('.album-infos');
                            var collectionItems = document.getElementsByClassName('collection-item-container');
                            document.querySelector('#bandcamp-greasy span.status').textContent = "Albums indexed:";
                            for (var i = 0; i < collectionItems.length; i++) {
                                var collectionItem = collectionItems[i];
                                if (collectionItem.getElementsByClassName('redownload-item').length === 0) {
                                    continue; // skip non-downloads, i.e. subscriptions
                                }
                                var itemDetails = collectionItem.getElementsByClassName('collection-item-details-container')[0];
                                var itemLink = collectionItem.getElementsByClassName('item-link')[0];
                                var albumTitle = itemDetails.getElementsByClassName('collection-item-title')[0];
                                var albumArtist = itemDetails.getElementsByClassName('collection-item-artist')[0];
                                var downloadLink = collectionItem.getElementsByClassName('redownload-item')[0].children[0];
                                var includeCheckbox = element('input', {type: 'checkbox'});
                                for (var existingItemLink of albumInfos.querySelectorAll('li > label > a.download')) {
                                    if (existingItemLink.href === downloadLink.href){
                                        /*console.log(itemLink)
                                        console.log(downloadLink)
                                        console.log(existingItemLink)*/
                                        includeCheckbox.disabled = true;
                                        break;
                                    }
                                }
                                albumInfos.appendChild(element('li', {className: 'album-info duplicate-' + includeCheckbox.disabled }, [
                                    element('label', {}, [
                                        includeCheckbox,
                                        element('a', {className: 'item', href: itemLink.href, target: '_blank'}, [
                                            element('span', {className: 'artist', textContent: albumArtist.innerText.substring(3)}),
                                            ' - ',
                                            element('span', {className: 'album', textContent: albumTitle.innerText}),
                                        ]),
                                        ' ',
                                        includeCheckbox.disabled ? element('span', {className: 'duplicate', textContent: "Duplicate"}) : element('a', {className: 'download', href: downloadLink.href, target: '_blank'}, ['(download)']),
                                    ]),
                                ]));
                            }
                            e.target.disabled = false;
                        }}}),
                element('button', {className: 'auto-scan-albums', textContent: "Auto-scan all albums"}, [], {onclick: {value(e) {
                            if (e.target.disabled) { return; }
                            e.target.disabled = true;
                            var parent = e.target.parentNode;
                            parent.parentNode.querySelector('.status').textContent = "Scrolling through your albums...";
                            document.querySelector('#collection-items .show-more').click();

                            setTimeout(function () {
                                var scrollInterval = setInterval(function () {
                                    window.scrollTo(0, window.scrollY + 1000);
                                }, 1);
                                var doneInterval = setInterval(function () {
                                    var loadMoreContainer = document.getElementsByClassName('expand-container')[0];
                                    if (window.getComputedStyle(loadMoreContainer).display === 'none') {
                                        showMainContainer();
                                        window.clearInterval(scrollInterval);
                                        window.clearInterval(doneInterval);
                                        e.target.disabled = false;
                                        parent.querySelector('.scan-albums').dispatchEvent(newMouseEvent('click', e.view));
                                    }
                                }, 2000);
                            }, 1000);
                        }}}),
                element('button', {className: 'clear-scanned-albums', textContent: "Clear scanned albums"}, [], {onclick: {value(e) {
                            var parent = e.target.parentNode;
                            parent.parentNode.querySelector('.album-infos').textContent = '';
                            parent.parentNode.querySelector('.status').textContent = "Cleared.";
                        }}}),
                element('button', {className: 'clear-duplicates', textContent: "Duplicate killer"}, [], {onclick: {value(e) {
                            var parent = e.target.parentNode;
                            var duplicateEntries = parent.parentNode.getElementsByClassName('duplicate-true');
                            console.log(duplicateEntries)
                            duplicateEntries.length > 0 ?
                                parent.parentNode.querySelectorAll(".duplicate-true").forEach(e => e.remove())
                                : parent.parentNode.querySelector('.status').textContent = "No duplicates found."
                            /* duplicateEntries ? parent.parentNode.getElementsByClassName('uniquefalse').remove().then(parent.parentNode.querySelector('.status').textContent = "Duplicates removed.") : parent.parentNode.querySelector('.status').textContent = "No duplicates found."*/
                        }}}),
            ]),
            element('ol', {className: 'album-infos', start: 0}),
            element('div', {className: 'controls'}, [
                element('button', {className: 'download-all', textContent: "Download all indexed albums"}, [], {onclick: {value(e) {
                            let i = 0;
                            for (let link of e.target.parentNode.parentNode.querySelectorAll('.album-infos .album-info input[type="checkbox"]:enabled ~ a.download')) {
                                window.setTimeout(() => {
                                    window.open(link.href, '_blank');
                                }, throttleDownloads ? i * throttleDownloadInterval * 1000 : 0);
                                i++;
                            }
                        }}}),
                element('button', {className: 'download-selected', textContent: "Download selected albums"}, [], {onclick: {value(e) {
                            let i = 0;
                            for (let link of e.target.parentNode.parentNode.querySelectorAll('.album-infos .album-info input[type="checkbox"]:enabled:checked ~ a.download')) {
                                window.setTimeout(() => {
                                    window.open(link.href, '_blank');
                                }, throttleDownloads ? i * throttleDownloadInterval * 1000 : 0);
                                i++;
                            }
                        }}}),
                element('p', {type: 'text', className: 'download-range range-description', textContent: "Album download range:"}),
                element('input', {type: 'text', className: 'download-range range-start', placeholder: "From"}),
                element('input', {type: 'text', className: 'download-range range-end', placeholder: "To"}),
                element('button', {className: 'download-range', textContent: "Download"}, [], {onclick: {value(e) {
                            var parent = e.target.parentNode;
                            var albumInfos = parent.parentNode.querySelectorAll('.album-infos > li');
                            var rangeStart = parseInt(parent.querySelector('.download-range.range-start').value);
                            var rangeEnd = parseInt(parent.querySelector('.download-range.range-end').value);
                            var rangeValid = true;
                            if (rangeStart < 0 || rangeStart >= allLinks.length) {
                                downloadRangeStart.value = null
                                rangeValid = false
                            }
                            if (rangeEnd < 0 ||  rangeEnd >= allLinks.length) {
                                downloadRangeEnd.value = null
                                rangeValid = false
                            }

                            if (!rangeValid) {
                                return
                            }
                            var throttleIndex = 0;
                            for (let i = rangeStart; i <= rangeEnd && i < albumInfos.length; i++) {
                                let link = albumInfos[i].querySelector('input[type="checkbox"]:enabled ~ a.download');
                                if (link != null) {
                                    window.setTimeout(function () {
                                        window.open(link.href, '_blank');
                                    }, throttleDownloads ? throttleIndex * throttleDownloadInterval * 1000 : 0);
                                    throttleIndex++;
                                }
                            }
                            downloadNextRangeButton.style.display = "block"
                            var downloadNextRangeButton = document.createElement('button')
                            downloadNextRangeButton.innerText = 'Download next range'
                            downloadNextRangeButton.style.display = "none"
                            downloadNextRangeButton.style.marginBottom = "10px"
                            downloadNextRangeButton.onclick = () => {
                                var rangeStart = parseInt(parent.querySelector('.download-range.range-start').value);
                                var rangeEnd = parseInt(parent.querySelector('.download-range.range-end').value);
                                var limit = rangeEnd - rangeStart + 1
                                parent.querySelector('.download-range.range-start').value = Math.min(rangeEnd + 1, allLinks.length - 1)
                                parent.querySelector('.download-range.range-end').value = Math.min(rangeEnd + limit, allLinks.length - 1)
                                document.querySelector('.download-range').click()
                            }
                        }}})
            ]),

            element('div', {className: 'controls'}, [
                element('label', {for: 'throttle-checkbox', textContent: 'Throttle downloads'}, []),
                element('input', {type: 'checkbox', id: 'throttleCheckbox', 'name': 'throttle-checkbox', checked: throttleDownloads}, [], { onchange: { value(e) {
                            showThrottleAmount();
                            throttleDownloads = e.currentTarget.checked;
                        }}}),
            ]),
            element('div', {className: 'controls', id: 'throttle-amount', style: ''}, [
                element('label', {for: 'throttle-interval', textContent: 'Amount (seconds):'}, []),
                element('input', {type: 'number', 'name': 'throttle-interval', 'step': 1, value: throttleDownloadInterval}, [], { oninput: { value(e) {
                            throttleDownloadInterval = Number(e.currentTarget.value)
                        }}}),
            ]),
        ]),
    ]);
    mainContainer.style.display = 'none';

    document.body.appendChild(mainContainer);
    document.getElementById('throttle-amount').style.display = 'none';
    function showThrottleAmount() {
        if (document.getElementById('throttleCheckbox').checked) { document.getElementById('throttle-amount').style.display = null; } else {
            document.getElementById('throttle-amount').style.display = 'none';
        }
    }
    // function removeDuplicates(arr) {
    //     return [...new Set(arr)];
    // }

    function hideMainContainer() {
        var mainContainer = document.getElementById('bandcamp-greasy');
        if (mainContainer.style.display !== 'none') { mainContainer.style.display = 'none'; }
    }
    function showMainContainer() {
        var mainContainer = document.getElementById('bandcamp-greasy');
        if (mainContainer.style.display === 'none') { mainContainer.style.display = null; }
    }

    setTimeout(function () {
        showMainContainer();
    }, 1000);
})();
