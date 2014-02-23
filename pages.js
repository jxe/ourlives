
// set up firebase

var facebook_id, firebase_user_id, F = new Firebase('https://lifestyles.firebaseio.com');
var auth = new FirebaseSimpleLogin(F, function(error, user) {
	if (!user) return;
    firebase_user_id = user.uid;
    facebook_id = user.id;

	F.child('users').child(user.uid).update({
		name: user.displayName,
		facebook_id: facebook_id
	});

    $('#login').hide();
});
function fb(){
	var args = Array.prototype.slice.call(arguments);
	var str = args.shift();
	var path = str.replace(/%/g, function(m){ return args.shift(); });
	return F.child(path);
}
function login(){ auth.login('facebook', { rememberMe: true }); }
$('#login').on('click', login);



function guess_type_of_link(link){
	if (link.name.match(/vimeo|youtube/)) return 'video';
	else if (link.name.match(/itunes|play/)) return 'app';
	else return 'website';
}


// pages!

var reveal = firewidget.reveal;

function about() { reveal('.page', 'about'); };


function lifestyles_index() {
	if (!firebase_user_id) return login();
	reveal('.page', 'lifestyles', {
		lifestyle_list: [fb('lifestyles'), function(data){
			lifestyle_detail(data.id, data.name);
		}],
		lifestyle_adder: function(name){
			fb('lifestyles').push({ name: name });
		}
	});
}


function links_index() {
	if (!firebase_user_id) return login();
	reveal('.page', 'links', {
		links_list: [fb('websites'), function(data){
			link_detail(data.id, data.name);
		}, { type: guess_type_of_link }],
		link_adder: function(name){
			fb('websites').push({ name: name });
		}
	});
}

function activities_index() {
	if (!firebase_user_id) return login();
	reveal('.page', 'activities', {
		all_activities_list: [fb('activities'), function(data){
			activity_detail(data.id, data.name);
		}],
		all_activity_adder: function(name){
			fb('activities').push({ name: name });
		}
	});
}

function identities_index() {
	if (!firebase_user_id) return login();
	reveal('.page', 'identities', {
		all_identities_list: [fb('identities'), function(data){
			identity_detail(data.id, data.name);
		}],
		identity_adder: function(name){
			fb('identities').push({ name: name });
		}
	});
}

function cities_index() {
	if (!firebase_user_id) return login();
	reveal('.page', 'cities', {
		all_cities_list: [fb('cities'), function(data){
			city_detail(data.id, data.name);
		}],
		city_adder: function(name){
			fb('cities').push({ name: name });
		}
	});
}

function city_detail(cid, name){
	reveal('.page', 'city', {
		city_name: name,
		city_lifestyles_list: [fb('lifestyles_by_city/%', cid), function(data){
			lifestyle_detail(data.id, data.name);
		}],
		city_lifestyle_adder: [fb('lifestyles'), function(data){
			if (!data.id) data.id = fb('lifestyles').push(data).name();
			fb('lifestyles/'+data.id+'/cities/'+cid).set({ name: name });
		}]
	});
}


function lifestyle_detail(lid, name){
	reveal('.page', 'lifestyle', {
		lifestyle_name: name,
		lifestyle_testimony: [fb('users/%/lifestyles/%/lived', firebase_user_id, lid), function(value){
			if (!name) return;
			if (value) fb('users/%/lifestyles/%', firebase_user_id, lid).update({ name: name });
			else fb('users/%/lifestyles/%', firebase_user_id, lid).remove();
		}],

		activities_list: [fb('activities_by_lifestyle/'+lid), function(data){
			activity_detail(data.id, data.name);
		}],

		activity_adder: [fb('activities'), function(data){
			if (!data.id) data.id = fb('activities').push(data).name();
			fb('activities/'+data.id+'/lifestyles/'+lid).set({ name: name });
		}],

		cities_list: [fb('lifestyles/'+lid+'/cities'), function(data){
			city_detail(data.id, data.name);
		}],

		users_list: [fb('users_by_lifestyle/%', lid), function(data){
			user_detail(data.id, data.name || "Unknown")
		}, {
			fbphoto: function(user){
				var fbid = user.id.split(':')[1];
				if (fbid) return "http://graph.facebook.com/"+fbid+"/picture";
				else return "";
			}
		}],

		lifestyle_city_adder: [fb('cities'), function(data){
			if (!data.id) data.id = fb('cities').push(data).name();
			fb('lifestyles/'+lid+'/cities/'+data.id).set({ name: data.name });
		}]
	});
}

function link_detail(wid, name){
	reveal('.page', 'link', {
		link_name: name,

		link_activities_list: [fb('activities_by_website/'+wid), function(data){
			activity_detail(data.id, data.name);
		}],

		link_activity_adder: [fb('activities'), function(data){
			if (!data.id) data.id = fb('activities').push(data).name();
			fb('activities/'+data.id+'/websites/'+wid).set({ name: name });
		}]
	});
}


function identity_detail(iid, name){
	reveal('.page', 'identity', {
		identity_name: name,

		identity_activities_list: [fb('activities_by_identity/'+iid), function(data){
			activity_detail(data.id, data.name);
		}],

		identity_activity_adder: [fb('activities'), function(data){
			if (!data.id) data.id = fb('activities').push(data).name();
			fb('activities/'+data.id+'/identities/'+iid).set({ name: name });
		}]
	});
}


function activity_detail(aid, name){
	$('#relative_preferences').hide();
	reveal('.page', 'activity', {
		activity_name: name,
		activity_would: fb('users/'+firebase_user_id+'/activities/'+aid+'/would'),
		activity_takes: fb('activities/'+aid+'/takes'),
		activity_time_desire: [fb('users/'+firebase_user_id+'/activities/'+aid+'/desire'), function(value){
			if (!value) return;
			$('#relative_preferences').show();
			firewidget({
				relative_for_desire: value,
				'.activity_name': name,
				recommended_activities: [fb('activities/%/preferred/%', aid, value), function(data){
					activity_detail(data.id, data.name);
				}],
				recommended_activities_adder: [fb('activities'), function(data){
					if (!data.id) data.id = fb('activities').push(data).name();
					var me = {}; me[firebase_user_id] = true;
					fb('activities/%/preferred/%/%', aid, value, data.id).set({name: data.name, by: me});
				}]
			});
		}],
		activity_lifestyles_list: [fb('activities/%/lifestyles', aid), function(data){
			lifestyle_detail(data.id, data.name);
		}],
		activity_lifestyles_adder: [fb('lifestyles'), function(data){
			if (!data.id) data.id = fb('lifestyles').push(data).name();
			fb('activities/%/lifestyles/%', aid, data.id).set(data);
		}],
		activity_links_list: [fb('activities/%/websites', aid), function(data){
			link_detail(data.id, data.name);
		}, { type: guess_type_of_link }],
		activity_link_adder: [fb('websites'), function(data){
			if (!data.id) data.id = fb('websites').push(data).name();
			fb('activities/%/websites/%', aid, data.id).set(data);
		}],
		activity_identities_list: [fb('activities/%/identities', aid), function(data){
			identity_detail(data.id, data.name);
		}],
		activity_identities_adder: [fb('identities'), function(data){
			if (!data.id) data.id = fb('identities').push(data).name();
			fb('activities/%/identities/%', aid, data.id).set(data);
		}]
	});
}


function user_detail(uid, name){
	if (uid == firebase_user_id) $('#user_lifestyle_adder').show();
	else $('#user_lifestyle_adder').hide();
	reveal('.page', 'user', {
		user_name: name,
		user_lifestyles_list: [fb('users/%/lifestyles', uid), function(data){
			lifestyle_detail(data.id, data.name);
		}],
		user_lifestyle_adder: [fb('lifestyles'), function(data){
			if (!data.id) data.id = fb('lifestyles').push(data).name();
			lifestyle_detail(data.id, data.name);
		}]
	});	
}
