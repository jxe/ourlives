
// set up firebase

var facebook_id, firebase_user_id, F = new Firebase('https://lifestyles.firebaseio.com');
var auth = new FirebaseSimpleLogin(F, function(error, user) {
	if (!user) return;
    firebase_user_id = user.uid;
    facebook_id = user.id;
    facebook_name = user.displayName;

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

		city_identities_list: [fb('cities/%/identities', cid), function(data){
			identity_detail(data.id, data.name);
		}],
		city_identity_adder: [fb('identities'), function(data){
			if (!data.id) data.id = fb('identities').push(data).name();
			fb('cities/'+cid+'/identities/'+data.id).set({ name: data.name });
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

function my_profile(){ user_detail(facebook_id, facebook_name); }

function user_detail(uid, name){
	if (uid == firebase_user_id) $('#user_lifestyle_adder').show();
	else $('#user_lifestyle_adder').hide();
	reveal('.page', 'user', {
		user_name: name,

		user_cities_list: [fb('users/%/cities', uid), function(data){
			city_detail(data.id, data.name);
		}],
		user_cities_adder: [fb('cities'), function(data){
			if (!data.id) data.id = fb('cities').push(data).name();
			fb('users/%/cities/%', uid, data.id).set(data);
		}],

		user_old_goals_list: [fb('users/%/old_identities', uid), function(data){
			identity_detail(data.id, data.name);
		}],
		user_old_goals_adder: [fb('identities'), function(data){
			if (!data.id) data.id = fb('identities').push(data).name();
			fb('users/%/old_identities/%', uid, data.id).set(data);
		}],

		user_new_goals_list: [fb('users/%/new_identities', uid), function(data){
			identity_detail(data.id, data.name);
		}],
		user_new_goals_adder: [fb('identities'), function(data){
			if (!data.id) data.id = fb('identities').push(data).name();
			fb('users/%/new_identities/%', uid, data.id).set(data);
		}]
	});	
}
