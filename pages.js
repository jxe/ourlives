
// set up firebase

var facebook_id, firebase_user_id, F = new Firebase('https://lifestyles.firebaseio.com');
var auth = new FirebaseSimpleLogin(F, function(error, user) {
	if (!user) return;
    firebase_user_id = user.uid;
    facebook_id = user.id;
    $('#login').hide();
});
function fb(){
	var args = Array.prototype.slice.call(arguments);
	var str = args.shift();
	var path = str.replace(/%/g, function(m){ return args.shift(); });
	return F.child(path);
}
$('#login').on('click', function(){ auth.login('facebook', { rememberMe: true }); });


// set up page revealer

var previous_widgets;
function reveal(page, firewidgets){
	$('.page').hide();
	$('#'+page).show();
	if (previous_widgets) firewidget.close(previous_widgets);
	previous_widgets = firewidget(firewidgets);
}

$('#goto_lifestyles_index').click(lifestyles_index);
$('#goto_activities_index').click(activities_index);




// pages!


function lifestyles_index() {
	reveal('lifestyles', {
		lifestyle_list: [fb('lifestyles'), function(data){
			lifestyle_detail(data.id, data.name);
		}],
		lifestyle_adder: function(name){
			fb('lifestyles').push({ name: name });
		}
	});
}

function lifestyle_detail(lid, name){
	reveal('lifestyle', {
		lifestyle_name: name,
		lifestyle_testimony: fb('users/'+firebase_user_id+'/lifestyles/'+lid+'/lived'),

		activities_list: [fb('activities_by_lifestyle/'+lid), function(data){
			activity_detail(data.id, data.name);
		}],

		activity_adder: [fb('activities'), function(data){
			if (!data.id) data.id = fb('activities').push(data).name();
			fb('activities/'+data.id+'/lifestyles/'+lid).set({ name: name });
		}],

		cities_list: [fb('lifestyles/'+lid+'/cities'), function(data){
			// jump to that city
		}],

		city_adder: [fb('cities'), function(data){
			if (!data.id) data.id = fb('cities').push(data).name();
			fb('lifestyles/'+lid+'/cities/'+data.id).set({ name: data.name });
		}]
	});
}

function activities_index() {
	reveal('activities', {
		all_activities_list: [fb('activities'), function(data){
			activity_detail(data.id, data.name);
		}],
		all_activity_adder: function(name){
			fb('activities').push({ name: name });
		}
	});
}

function activity_detail(aid, name){
	$('#relative_preferences').hide();
	reveal('activity', {
		activity_name: name,
		activity_would: fb('users/'+firebase_user_id+'/activities/'+aid+'/would'),
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
		}]
	});
}
