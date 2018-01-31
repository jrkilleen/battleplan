var markers;
var markercount;
var socket;
var map;
var crosshair;
var editing = false;
var selector;
var chicon;
var selectedmarker;
var editbutton;
var savebutton;
var removebutton;
var cancelbutton;
var bp1;
var addmarkerbutton;
var bufferdistance = 1;
var connecteduser;
var editormode;
var markertypeselector;
var types = ['AOI','Mine','Hostile Base','DI Base','Ally Base','Stash','Downed Heli','Rally Point', 'Zerg Base', 'Monument', 'Ore', 'Trees', 'Store'];
var typesurls = ['blackx.png','mine.png','hostilebase.png','dibase.png','allybase.png','stash.png','heli.png','blueflag.png', 'zerg.png', 'monument.png', 'ore.png', 'forest.png', 'store.png'];
var typeszsizes = ['15','25', '35', '45', '55', '65'];
var typesicons;
var titlepanel;
var enteredtitle;
var wsc;
var MARKERSIZE = 25;
var currentzoom = 0;
var MAXMAPZOOM = 3;
var MINMAPZOOM = 0;
var MAXNOTESIZE = 400;
var MAXTITLESIZE = 30;
var MAXLATLNG = 40000;

// clears the values in the editor panel
function clearinput(){
	document.getElementById("yv").value = '';
	document.getElementById("xv").value = '';
	document.getElementById("usersubmittedby").value = '';
	document.getElementById("notes").value = '';
	document.getElementById("dateposted").value = '';
	document.getElementById("lastupdated").value = '';
    titlepanel.innerHTML = '';
	document.getElementById("titlepanel").value = '';
	document.getElementById('usersubmittedby').innerHTML = '';
	document.getElementById('usereditedby').innerHTML = '';
	document.getElementById('dateposted').innerHTML = '';
	document.getElementById('lastupdated').innerHTML = '';
}

// adds a user to the user list side bar panel
function addusertolist(username){
    var userlist = document.getElementById("userlist");
    var li = document.createElement("li");
    li.appendChild(document.createTextNode(username));
    userlist.appendChild(li);
}

// adds a log to the history list side bar panel
function addlogtolist(log){
    var historylist = document.getElementById("historylist");
    var li = document.createElement("li");
    li.appendChild(document.createTextNode(log));
    historylist.appendChild(li);
}

function removeuserfromlist(username){

}
function distance(x1, y1, x2, y2){
	var latdist = x1-x2;
	var lngdist = y1-y2;
	return Math.sqrt(lngdist*lngdist+latdist*latdist);
}

// controls state based switching of the editor panel
function seteditormode(mode){
		
	switch (mode) {
		case 'addmode':
			console.log('addmode');			
			editormode = mode;
			
			clearinput();
			inputon(true);
			
			deselectmarker();
			
                        if(document.getElementById("editbutton") == null ){
				titlepanel.appendChild(enteredtitle);
			}
                        
			
			//document.getElementById("usersubmittedby").innerHTML = connecteduser;
			// if exists remove it
			if(document.getElementById("editbutton")){
				bp1.removeChild(document.getElementById("editbutton"));
			}
			if(document.getElementById("removebutton")){
				bp1.removeChild(document.getElementById("removebutton"));
			}
			// if doesn't exist add it
			if(typeof(document.getElementById("savebutton")) != null){
				bp1.appendChild(savebutton);
			}
			if(typeof(document.getElementById("cancelbutton")) != null){
				bp1.appendChild(cancelbutton);
			}
			break;

		case 'editmode':
			console.log('editmode');
			
			inputon(true);
			document.getElementById("selectedmarkertype").selectedIndex = selectedmarker._type;	
			//deselectmarker();
			
			editormode = mode;
			// if exists remove it
			if(document.getElementById("editbutton")){
				bp1.removeChild(document.getElementById("editbutton"));
			}
			// if doesn't exist add it
			if(typeof(document.getElementById("savebutton")) != null){
				bp1.appendChild(savebutton);
			}
			if(typeof(document.getElementById("removebutton")) != null){
				bp1.appendChild(removebutton);
			}
			if(typeof(document.getElementById("cancelbutton")) != null){
				bp1.appendChild(cancelbutton);
			}
			
			break;

		case 'blankmode':
			console.log('blankmode');
			deselectmarker();

			editormode = mode;
			disablecrosshair();

            document.getElementById('markertype').innerHTML = '';
            document.getElementById("yv").value = '';
            document.getElementById("xv").value = '';
            document.getElementById("usersubmittedby").value = '';
            document.getElementById("notes").value = '';
            document.getElementById("dateposted").value = '';
            document.getElementById("lastupdated").value = '';
            titlepanel.innerHTML = '';
            document.getElementById("titlepanel").value = '';
            document.getElementById('usersubmittedby').innerHTML = '';
            document.getElementById('dateposted').innerHTML = '';
            document.getElementById('lastupdated').innerHTML = '';
			document.getElementById('usereditedby').innerHTML = '';           
                        
			inputon(false);

			deselectmarker();

			// if exists remove it
			if(document.getElementById("savebutton")){
				bp1.removeChild(savebutton);
			}			
			if(document.getElementById("removebutton")){
				bp1.removeChild(removebutton);
			}
			if(document.getElementById("cancelbutton")){
				bp1.removeChild(cancelbutton);
			}
			if(document.getElementById("editbutton")){
				bp1.removeChild(editbutton);
			}

			break;

		case 'viewmode':
			console.log('viewmode');
			inputon(false);
			//clearinput();
			editormode = mode;
			// if exists remove it
			if(document.getElementById("savebutton")){
				bp1.removeChild(savebutton);
			}			
			if(document.getElementById("removebutton")){
				bp1.removeChild(removebutton);
			}
			if(document.getElementById("cancelbutton")){
				bp1.removeChild(cancelbutton);
			}
			
			// removed as the user may not be able to edit marker 
			// if doesn't exist add it
			if(typeof(document.getElementById("editbutton")) != null){
				bp1.appendChild(editbutton);
			}

			break;
	}
}

function selectmarker(e){

	if(document.getElementById('savebutton')){
		bp1.removeChild(savebutton);
	}
	
	if(document.getElementById('removebutton')){
		bp1.removeChild(removebutton);
	}
	
	if(document.getElementById('cancelbutton')){
		bp1.removeChild(cancelbutton);
	}
	
	if(document.getElementById('editbutton')){
		
	}else{
		bp1.appendChild(editbutton);
	}
	
	inputon(false);
	
	selector.setLatLng(e.latlng);
	
	for (var i = 0, len = markers.length; i < len; i++) {

		if (markers[i].getLatLng().lat == e.latlng.lat && markers[i].getLatLng().lng == e.latlng.lng) {
			console.log(markers[i].getLatLng());
			selectedmarker = markers[i];
			titlepanel.innerHTML = selectedmarker._title;
		
			document.getElementById('xv').value = selectedmarker.getLatLng().lng;
			document.getElementById('yv').value = selectedmarker.getLatLng().lat;
			document.getElementById('markertype').innerHTML = types[selectedmarker._type];
			document.getElementById('usersubmittedby').innerHTML = selectedmarker._usersubmittedby;
			document.getElementById('dateposted').innerHTML = selectedmarker._dateposted ;
			document.getElementById('lastupdated').innerHTML = selectedmarker._datelastupdated;
			//document.getElementById('usereditedby').innerHTML = selectedmarker._userlastedited;
			document.getElementById('notes').value = selectedmarker._notes;
			
			break;		
		} else {
			
		}
	}

}

// moves (but does not destroy) the selected marker indicator
function deselectmarker(){
	console.log('deselecting marker');
	selector.setLatLng(new L.LatLng(-1000, -1000));
	selectedmarker = null;
	
}

// clear selection function
function clearSelection() {

	window.getSelection().removeAllRanges();
    
}

// removes a marker from the map with the matching id
function removeMarker(id) {
    // if the current selected marker is the one that needs to be removed
    // change view mode to blank
	if(selectedmarker != null && selectedmarker._id == id){
		if(editormode == 'viewmode'){
			seteditormode('blankmode');
		}
	}

	// remove the marker and rebuild the stack
    // this is inefficient, wastes memory and needs to be fixed
	var new_markers = [];
	for (var i = 0, len = markers.length; i < len; i++) {
		if (markers[i]._id == id) {
			map.removeLayer(markers[i]);			
		} else {
			new_markers.push(markers[i]);
		}
	}

	// set the markers pointer to the rebuilt stack
	markers = new_markers

    // marker no longer exists, deselect it
	deselectmarker();

}

// edits an on map marker
function editmarker(data){
    // search the markers stack and find one with a matching id to the one provided in data
    for (var i = 0, len = markers.length; i < len; i++) {
        if (markers[i]._id == data.id) {
            markers[i]._title = data.title;
            markers[i]._type = data.type;
			markers[i]._notes = data.notes;
			markers[i]._userlastedited = data._userlastedited;
			markers[i]._datelastupdated = data.datelastupdated;
			
			var url = '/map/' + typesurls[data.type];
           
            var cicon = L.icon({
                    iconUrl: url,
                    iconSize: [MARKERSIZE, MARKERSIZE],

            });
            
            markers[i].setIcon(typesicons[currentzoom][markers[i]._type]);
            
            if(selectedmarker._id == markers[i]._id){
				if(editormode == 'viewmode'){
					document.getElementById('titlepanel').innerHTML = markers[i]._title;                                    
					document.getElementById('xv').value = markers[i].getLatLng().lng;
					document.getElementById('yv').value = markers[i].getLatLng().lat;
					document.getElementById('markertype').innerHTML = types[markers[i]._type];
					document.getElementById('usersubmittedby').innerHTML = markers[i]._usersubmittedby;
					document.getElementById('dateposted').innerHTML = markers[i]._dateposted ;
					document.getElementById('lastupdated').innerHTML = markers[i]._datelastupdated;
					//document.getElementById('usereditedby').innerHTML = markers[i]._userlastedited;
					document.getElementById('notes').value = markers[i]._notes;
				}else if(editormode == 'editmode'){
					//seteditormode('viewmode');
				}
			}
            break;
        } else {
            
        }
    }
}


function getRandomInt(max, min){
	return 0;
}
function addabunchoffakemarkers(markersperrow, rows){
    for (var i = 0, len = markersperrow; i < len; i++) {
        var data = {
        	id: (1000 + i) + '',
            lat: data.getRandomInt(500, -500) + '',
            lng: data.getRandomInt(500, -500) + '',
            title: "test title " + i,
            type: data.getRandomInt(0, types.length) + '',
            notes: "test notes " + i
        }
    }
}


// adds a marker to the map
function addMarker(data) {

	// create coordinate object that marker will be placed at
	var e = new L.LatLng(data.lat, data.lng);

	// choose marker icon
	var url = '/map/' + typesurls[data.type];
	var cicon = L.icon({
		iconUrl: url,
		iconSize: [MARKERSIZE, MARKERSIZE],

	});
	console.log(JSON.stringify(typesicons[currentzoom][data.type]));
	// create a marker given the attributes provided in data
	marker = new L.marker(e, {
		icon: typesicons[currentzoom][data.type],
	})
	

	marker._id = data.id;
	marker._title = data.title;
	marker._type = data.type;
	marker._usersubmittedby = data.usersubmittedby;
	marker._dateposted = data.dateposted;
	marker._datelastupdated = data.datelastupdated;
	marker._notes = data.notes;

	// Create custom popup content
	var popupContent =  '<a>' + marker._title + '</a>';

	marker.bindPopup(popupContent,{
		closeButton: false,
		//minWidth: 320,

	});

	// set marker events
	marker.on('mouseover', function (e) {
		if (editormode == 'blankmode' || editormode == 'viewmode' || editormode == 'editmode') {
            this.setIcon(typesicons[currentzoom+1][this._type]);
			this._popup.setContent('<a>' + this._title + '</a>');
			this.openPopup();
		}
	});
	marker.on('mouseout', function (e) {
		if (editormode == 'blankmode' || editormode == 'viewmode' || editormode == 'editmode') {
            this.setIcon(typesicons[currentzoom][this._type]);
			this.closePopup();
		}
	});

	marker.on("click", function (e) {
		if (editormode == 'blankmode' || editormode == 'viewmode' || editormode == 'editmode') {
			seteditormode('viewmode');
			L.control.sidebar('sidebar').open("home");
			selectmarker(e);
		}
	});

	// add new marker to the markers stack
	markers.push(marker);

	// add marker to map
	marker.addTo(map);
	

}

// positions the crosshair "add marker" indicator
function movecrosshair(e) {
	
	crosshair.setLatLng(e);
	console.log('moving crosshair');
	if (e.lat > -1000) {
		document.getElementById('xv').value =  Math.round(e.lng);
		document.getElementById('yv').value =  Math.round(e.lat);
	} else {
		
	}
}

// enables add marker mode
function enablecrosshair() {
	//  wsc.send("Here's some text that the server is urgently awaiting!"); 

	// enable crosshairs..
	document.getElementById('map').style.cursor = 'crosshair'
	movecrosshair(new L.LatLng(0, 0));
}

// disables add marker mode
function disablecrosshair() {
	// disable crosshairs..
	document.body.style.cursor = '';
	document.getElementById('map').style.cursor = '';
	movecrosshair(new L.LatLng(-1000, -1000));
}

// enables/disables editing marker attributes in the editor panel
function inputon(state){

	if(state){
            console.log("input on");
		document.getElementById('markertype').innerHTML = '';
		// if doesn't exist add it
		if(typeof(document.getElementById("selectedmarkertype")) != null){			
			document.getElementById('markertype').appendChild(markertypeselector);
		}
		
		if(document.getElementById("titlepanel").innerHTML != ''){
                    enteredtitle.value = document.getElementById("titlepanel").innerHTML;
                }else{
                    enteredtitle.value = '';
                }
		titlepanel.innerHTML = '';
                titlepanel.appendChild(enteredtitle);
                
		document.getElementById("selectedmarkertype").selectedIndex = 0;
		
		document.getElementById("xv").readOnly = false;
		document.getElementById("xv").style.backgroundColor = "white";
                    
		document.getElementById("yv").readOnly = false;
		document.getElementById("yv").style.backgroundColor = "white";
		
		document.getElementById("notes").readOnly = false;
		document.getElementById("notes").style.backgroundColor = "white";
	}else{
		if(selectedmarker != null){
			document.getElementById('markertype').innerHTML = types[selectedmarker._type];
		}else{
			document.getElementById('markertype').innerHTML = '';
		}
		
		if(document.getElementById("enteredtitle") != null){
			titlepanel.innerHTML = document.getElementById("enteredtitle").value;
		}

		document.getElementById("xv").readOnly = true;
		document.getElementById("xv").style.backgroundColor = "#A8A8A8";
		
		document.getElementById("yv").readOnly = true;
		document.getElementById("yv").style.backgroundColor = "#A8A8A8";
		
		document.getElementById("notes").readOnly = true;
		document.getElementById("notes").style.backgroundColor = "#A8A8A8";
	}
}




// runs once on page load
function init() {

		var loc = window.location, new_uri;
		if (loc.protocol === "https:") {
			new_uri = "wss:";
		} else {
			new_uri = "ws:";
		}
		new_uri += "//" + location.hostname + ":" + location.port;
		
		console.log("connecting to ws at " + new_uri);
		wsc = new WebSocket(new_uri);
		
		wsc.onmessage = function(message){

			console.log("RECEIVED MESSAGE: " + message.data);
			var msg;
			try{
                msg = JSON.parse(message.data);
                switch (msg.cmd) {
                    case 'addmarker': {
                        addMarker(msg.marker);
                        break;
                    }

                    case 'editmarker': {
                        editmarker(msg.marker);
                        break;
                    }

                    case 'removemarker': {
                        removeMarker(msg.id);
                        break;
                    }

                    default: {
                        console.log(message);
                    }

                }
			}catch(error){

			}
		}
		
		wsc.onopen = function() {
			console.log("connected to web socket");
			// var msg = '';
			// for(i = 1; i < 444; i++){
				// msg += 'p';
			// }

			wsc.send(JSON.stringify({cmd:'mapupdate'}));
			//wsc.send(data);
		}
		
		
		
        // title panel
        titlepanel = document.getElementById("titlepanel");
        enteredtitle = document.createElement("input");
        enteredtitle.setAttribute("id", "enteredtitle");
        enteredtitle.setAttribute("maxlength", MAXTITLESIZE);
        

        // marker type selection view	 
        markertypeselector = document.createElement("SELECT");
        markertypeselector.setAttribute("id", "selectedmarkertype");

        for (var i = 0, len = types.length; i < len; i++){
            var z = document.createElement("option");
            z.setAttribute("value", i);
            z.innerHTML = types[i];
            markertypeselector.appendChild(z);    
        }
	
	// button panel
	bp1 = document.getElementById('buttonpannel1');
	
	// create buttons
	savebutton = document.createElement("BUTTON");
	savebutton.setAttribute('class', 'savebutton');
	savebutton.innerHTML = "Save";
	savebutton.id = 'savebutton';
	
	savebutton.addEventListener("click", function () {
		
		data={
			lat:	Math.round(document.getElementById("yv").value)+'',
			lng:	Math.round(document.getElementById("xv").value)+'',
			title:	document.getElementById("enteredtitle").value + ' ',
			type:	Math.round(document.getElementById("selectedmarkertype").selectedIndex)+'',
			notes: document.getElementById("notes").value + ' ',
		}	
		console.log(data);
		//determine if the marker to be added is within the proximity of an existing marker
		var proximitycheck = true;
		for (var i = 0, len = markers.length; i < len; i++) {		
			if(distance(markers[i].lat, markers[i].lng, data.lat, data.lng) < bufferdistance){
				proximitycheck = false;
				break;
			}
		}
		if(proximitycheck && data.title.length > 0){
			if(editormode=='addmode'){
				//add marker			
				//socket.emit('addmarker', data);
				wsc.send(JSON.stringify({cmd:'addmarker', marker: data}));
				disablecrosshair();
				seteditormode('blankmode');
							
			}else if(editormode=='editmode'){
				data.id = selectedmarker._id+'';
				wsc.send(JSON.stringify({cmd:'editmarker', marker: data}));
				//socket.emit('editmarker',data);
				//deselectmarker();
				seteditormode('viewmode');
			}	
		}else{
			
		}
		
		
	});
	
	removebutton = document.createElement("BUTTON");
	removebutton.setAttribute('class', 'removebutton');
	removebutton.innerHTML = "Remove";
	removebutton.id = 'removebutton';
	
	removebutton.addEventListener("click", function () {

        wsc.send(JSON.stringify({cmd:'removemarker', id: selectedmarker._id+''}));
		seteditormode('blankmode');
	});
	
	cancelbutton = document.createElement("BUTTON");
	cancelbutton.id = 'cancelbutton';
	cancelbutton.innerHTML = "Cancel";
	savebutton.setAttribute('id', 'cancelbutton');
	cancelbutton.addEventListener("click", function () {
                if(editormode=='editmode'){
                    seteditormode('viewmode');
                }else{
                    seteditormode('blankmode');
                }
		
		
	});
	
	editbutton = document.createElement("BUTTON");
	editbutton.id = 'editbutton';
	editbutton.innerHTML = "Edit";
	savebutton.setAttribute('id', 'savebutton');
	
	
	editbutton.addEventListener("click", function () {
		
		if(editormode='viewmode'){
                    seteditormode('editmode');
                }
		
		
		
	});
	
	addmarkerbutton = document.getElementById("addmarkerbutton");
	addmarkerbutton.addEventListener("click", function () {
		if(editormode=='addmode'){
			seteditormode('blankmode');
			disablecrosshair();
		}else{
			
			seteditormode('addmode');
			deselectmarker();
			enablecrosshair();
		}
	});
	



	// INITIALIZE MAP
	markercount = 0;
	markers = [];

	// generate marker type icons
	//typesicons = new Array(typeszsizes.length);
	typesicons =[];
	console.log(typesicons.length);
	for (var i = 0, len = typeszsizes.length; i < len; i++) {
		//var iconsatcurrentzoom = new Array(typesurls.length);
		typesicons[i] = [];
		for (var j = 0, len = typesurls.length; j < len; j++) {	
			
			typesicons[i][j] =  L.icon({
				iconUrl: '/map/' + typesurls[j],
				iconSize: [typeszsizes[i], typeszsizes[i]],
			});
		}	
		//typesicons[i] = iconsatcurrentzoom;
	}
	//console.log(JSON.stringify(typesicons[1][0]));
	console.log(typesicons.length);
	//var bounds = [[0,0], [1000,1000]];
	var bounds = [[-500, -500], [500, 500]];

	// create crs stype map
	map = L.map('map', {
			crs: L.CRS.Simple,
			//maxBounds:[[-500,-500], [1500,1500]],
			maxBounds: [[-2000, -2000], [2000, 2000]],
			minZoom: MINMAPZOOM,
			maxZoom: MAXMAPZOOM
		});

	// set map image
	var image = L.imageOverlay('/map/map.png', bounds).addTo(map);

	// fit map to bounds
	map.fitBounds(bounds);

	// create map sidebar
	var sidebar = L.control.sidebar('sidebar').addTo(map);

	// add cross hair
	chicon = L.icon({
		iconUrl: '/map/crosshair.png',
		iconSize: [30, 30],

	});

	crosshair = new L.marker(new L.LatLng(-10000, -10000), {
			icon: chicon
	}).addTo(map);

	// set up map event listeners
	map.on('click', function (e) {
		if(editormode=='addmode'){	
			var markertooclose = false;
			for (var i = 0, len = markers.length; i < len; i++) {	
				var distance = Math.round(Math.sqrt(Math.pow(e.latlng.lat-markers[i].getLatLng().lat, 2)+Math.pow(e.latlng.lng-markers[i].getLatLng().lng, 2)));
				console.log("distance: " + distance);
				if(distance <= bufferdistance){
					markertooclose = true;
					break;
				}else{			
					
				}				
			}
			if(!markertooclose){
				movecrosshair(e.latlng);	
			}		
		}else{
			seteditormode('blankmode');
            L.control.sidebar('sidebar').close();
		}
	});
	

	
	map.on('zoomend', function() {
		var mapzoom = map.getZoom();
		//console.log("zoom level: " + mapzoom);
		//console.log("TYPES LEN " + typesicons);
		if(mapzoom > typeszsizes.length){
			currentzoom = typeszsizes.length;			
		}else{
			currentzoom = mapzoom;
		}	
		//console.log("effective zoom level: " + currentzoom);
		for (var i = 0, len = markers.length; i < len; i++) {
			
			markers[i].setIcon(typesicons[currentzoom][markers[i]._type]);
		}
	});
	
	
	// add selector
	var selectoricon = L.icon({
			iconUrl: '/map/crosshair.png',
			iconSize: [1, 1],

		});	
		
	selector = new L.marker(new L.LatLng(-10000, -10000), {
			icon: selectoricon
	}).addTo(map);		
	

	// coordinate tracker
	var coordinates = L.control({
			position: 'bottomright'
		});

	coordinates.onAdd = function (map) {

		var div = L.DomUtil.create('div', 'coordinates');
		div.id = "coordinates";
		div.innerHTML = "coordinates X:0, Y:0";

		return div;
	};

	coordinates.addTo(map);

	map.addEventListener('mousemove', function (ev) {

		var lat = Math.round(ev.latlng.lat);
		var lng = Math.round(ev.latlng.lng);
		document.getElementById("coordinates").innerHTML = "coordinates X:" + lng + ", Y:" + lat;
		coordinates.x = lng+'';
		coordinates.y = lat+'';
		
	});
	
	// add a legend to the map
	var legend = L.control({position: 'topright'});

	legend.onAdd = function (map) {

		var div = L.DomUtil.create('div', 'my-legend');
		var list = L.DomUtil.create('ul');

		for (var i = 0, len = types.length; i < len; i++){
			var li = document.createElement("li");
			//var span = document.createElement("SPAN");
			//var t = document.createTextNode(types[i]);
			var t = document.createElement("LABEL");
			t.innerHTML = types[i];				
			t.setAttribute("for", x);
			t.setAttribute("display", "block");
			
			
			var x = document.createElement("IMG");
			x.setAttribute("src", "/map/"+typesurls[i]);
			x.setAttribute("width", MARKERSIZE+'');
			x.setAttribute("height", MARKERSIZE+'');

			li.appendChild(x);
			li.appendChild(t);
			//li.appendChild(span)
			list.appendChild(li);
		}
		
		
		
		div.appendChild(list);

		return div;
	};

	legend.addTo(map);

	
	// add layer control to legend

    // populate userlist
    for (var i = 0, len = 50; i < len; i++){
        addusertolist("user " + i);
    }

	// populate loglist
	// populate userlist
    for (var i = 0, len = 50; i < len; i++){
        addlogtolist("log " + i);
    }
	
	// start up editor panel in blank mode
	seteditormode('blankmode');

}
