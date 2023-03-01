# CGA Groovecollector
This project utilises [Bandcamp Greasy](https://github.com/RyanBluth/Bandcamp-Greasy) and adds functionality for certain usecases.
A set of [Tamper Monkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) scripts which allow you to download your entire bandcamp collection.

This chrome extension is needed for the scripts to work, so make sure you are using the google chrome browser.


## Usage
1. Import [DownloadCollection](https://github.com/joostflick/cga-groovecollector/raw/master/DownloadCollection.user.js) and [DownloadAlbum](https://github.com/joostflick/cga-groovecollector/raw/master/DownloadAlbum.user.js) into Tamper Monkey by simply clicking the links (which should bring up the install dialog)
2. Change the value of YOUR_USERNAME to your actual username in DownloadCollection.user.js
3. Change the value of format to your desired format (MP3 320 is the default) in DownloadAlbum.user.js
  - Available formats are as follows...
    - MP3 320 (Default)
    - MP3 V0
    - FLAC
    - AAC
    - Ogg Vorbis
    - ALAC
    - WAV
    - AIFF
4. Make sure Tamper Monkey is enabled.
5. Navigate to your collection on Bandcamp and a UI will show up.
6. If you are downloading a large collection and not everything is downloading, try enabling throttling and experiment a bit with the right delay

## Unzipping all folders after downloading
[Mac OS](https://github.com/RyanBluth/Bandcamp-Greasy)
[Windows](https://www.7-zip.org/)