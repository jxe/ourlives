
// set up firebase
var F = new Firebase('https://lifestyles.firebaseio.com');
var facebook_id, firebase_user_id, on_auth, m;
var auth = new FirebaseSimpleLogin(F, function(error, user) {
	if (!user) return;
    firebase_user_id = user.uid;
    facebook_id      = user.id;
    facebook_name    = user.displayName;
	F.child('users').child(user.uid).update({
		name: user.displayName,
		facebook_id: facebook_id
	});
    $('#login').hide();
    if (on_auth) on_auth();
});
function fb(){
	var args = Array.prototype.slice.call(arguments);
	var str = args.shift();
	var path = str.replace(/%/g, function(m){ return args.shift(); });
	return F.child(path);
}
function login(){ auth.login('facebook', { rememberMe: true }); }
$('#login').on('click', login);

function with_user(cb){
	if (firebase_user_id) return cb();
	on_auth = cb;
	login();
}

function with_page_info(url, cb){
	$.ajax({
	      url: "/url/" + encodeURIComponent(url),
	      dataType: 'json',
	      success: function(data) {
	      	console.log('got data: ', data);
		  	cb(url, data.title, data.title);
	      }
	});

	// $.ajax({
	//   url: url,
	//   dataType: 'html',
	//   success: function(data){
	//   	var title = data.getElementByTagName('title').innerText;
	//   	cb(url, title, title);
	//   }
	// });
}


function canonicalize_link(url){
    if (!url) return;
    if (url.match(/^http/)){
    	// strip http(s?)
	    var match = url.match(/:\/\/(.[^/]+)/);
	    if (!match) return url;
	    // and leading www.
	    return (match[1]).replace('www.','');    	
    } else {
    	return url;
    }
}

function encodeFirebasePath(path){
	return encodeURIComponent(path).replace(/\./g, '%2E');
}

function id_for_link(url){
	return encodeFirebasePath(canonicalize_link(url));
}

function guess_type_of_link(data){
	if (!data) return '';
	var link = data.url || data.name || data;
	if (link.match(/vimeo|youtube/)) return 'a video';
	else if (link.match(/itunes|play/)) return 'an app';
	else if (link.match(/amazon|stripe|square|etsy|groupon/)) return 'a product';
	else if (link.match(/yelp|foursquare/)) return 'a venue';
	else return 'a website';
}


// pages!

window.reveal = firewidget.reveal;



// indexes

function links_index() {
	if (!firebase_user_id) return login();
	reveal('.page', 'links', {
		links_list: [fb('websites'), function(data){
			link_detail(data.id, data.name);
		}, { type: guess_type_of_link }],
		link_adder: function(name){
			with_user(function(){
				with_page_info(name, function(url, short_title, full_title){
					fb('websites').child(id_for_link(url)).update({ url: url, name: short_title, title: full_title });
				});
			});
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




// detail pages

function city_detail(cid, name){
	reveal('.page', 'city', {
		city_name: name,

		city_identities_list: [fb('cities/%/identities', cid), function(data){
			identity_detail(data.id, data.name);
		}],
		city_identity_adder: [fb('identities'), function(data){
			if (!data.id) data.id = fb('identities').push(data).name();
			fb('cities/'+cid+'/identities/'+data.id).set({ name: data.name });
		}],

		city_users_list:  [fb('users_by_city/'+cid), function(data){
			user_detail(data.id, data.name);
		}]
	});
}


function link_detail(wid, name){
	function update_activity_subpage(aid, aname){
		console.log('loading subpage', aid, aname);
		reveal('.subpage', 'link_activity_subpage', {
			link_activity_subpage_label: aname,
			link_activity_identities_list: [fb('activities/%/identities', aid), function(data){
				identity_detail(data.id, data.name);
			}],
			link_activity_identities_adder: [fb('identities'), function(data){
				with_user(function(){
					if (!data.id) data.id = fb('identities').push(data).name();
					fb('activities/%/identities/%', aid, data.id).set(data);
				});
			}],

			recommended_activities: [fb('activities/%/identities', aid), function(data, ev){
				console.log(ev.target.tagName);
				if (ev.target.tagName == 'B'){
					activity_detail(data.related_activity_id, data.related_activity_name);
				} else if (ev.target.tagName == 'I'){
					identity_detail(data.id, data.name);
				}
			}, {
				related_activity_name: function(o, cb){
					fb('activities_by_identity/%', o.id).once('value', function(snap){
						var all = snap.val();
						var first_id = Object.keys(all)[0];
						console.log(all[first_id], first_id);
						o.related_activity_id = first_id;
						cb(all[first_id].name);
					});
					return "...";
				}
			}, 'related_'],
		});
	}

	reveal('.page', 'link', {
		link_name: name,
		link_name_again: name,
		link_type: guess_type_of_link({url: decodeURIComponent(wid), name:name}),

		link_activity_chooser: [fb('activities_by_website/%', wid), fb('users/%/links/%/activity', firebase_user_id, wid), function(data){
			if (data && data.id) update_activity_subpage(data.id, data.name);
		}],

		link_activity_adder: [fb('activities'), function(data){
			with_user(function(){
				if (!data.id) data.id = fb('activities').push(data).name();
				fb('activities/%/websites/%', data.id, wid).set({ name: name });
				fb('users/%/links/%/activity', firebase_user_id, wid).set(data.id);
				update_activity_subpage(data.id, data.name);
			});
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
		}],

		identity_old_users_list: [fb('users_by_old_goal/'+iid), function(data){
			user_detail(data.id, data.name);
		}],

		identity_current_users_list: [fb('users_by_new_goal/'+iid), function(data){
			user_detail(data.id, data.name);
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
			if (!data.id) data.id = fb('websites').child(id_for_link(data.name)).set(data).name();
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
	console.log('user_detail', uid, name);
	// if (uid == firebase_user_id) $('#user_lifestyle_adder').show();
	// else $('#user_lifestyle_adder').hide();
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




// jumpers

function about() { reveal('.page', 'about'); };

function my_profile(){ user_detail(firebase_user_id, facebook_name); }

function jump_to_user(uid){
	fb('users/%', uid).once('value', function(snap){
		var data = snap.val();
		if (data) user_detail(uid, data.name);
	});
}

function jump_to_link(link){
	var raw_link = decodeURIComponent(link);
	link_detail(encodeFirebasePath(link), raw_link);
}



// jump from URL

if (m = window.location.hash.match(/user\/(.*)$/)){
	console.log('matched!', m[1]);
	// on_auth = function(){ jump_to_user(m[1]); }
	jump_to_user(m[1]);
} else if (m = window.location.hash.match(/url\/(.*)$/)){
	console.log('matched!');
	// on_auth = function(){ jump_to_link(m[1]); }
	jump_to_link(m[1]);
}
