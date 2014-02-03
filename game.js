var game, auto_add;
var auth = new FirebaseSimpleLogin(F, function(error, user) {
	if (user){
	  firebase_user_id = user.uid;
	  facebook_id = user.id;
	  $('#login').hide();
	}
});



function* ask_about_lifestyle(lifestyle){
	if (!lifestyle.has_lived || !lifestyle.has_lived[firebase_user_id]){
		ask("How long did you live as a "+lifestyle.name+"?", 'lifestyle_timeframes');
		User.lived_lifestyle(lifestyle, (yield null));
	}
}


function new_activity(name, time_desire, container, options){
	if (!options) options = {};
	options.name = name;
	options.desires = [time_desire];
	options[container.collection] = [container.id];
	return F.child('activities').push(options).name();
}


function ensure_activity_in_container(activity, container){
	var current_set = activity[container.collection] || [];
	if (current_set.indexOf(container.id) < 0){
		current_set.push(container.id);
		var update_spec = {};
		update_spec[container.collection] = current_set;
		F.child('activities').child(activity.id).update(update_spec);
	}
}


function* play(){
	while(1){

		// 1. pick or add a lifestyle

		ask("Pick a lifestyle you've lived, a city you've lived in, or a thing you want to be:", ['lifestyles', 'cities', 'identities'], {auto_add: true});
		var container = yield null;

		if (container.collection == 'lifestyles'){
			yield *ask_about_lifestyle(container);
		}



		// 2. pick or add an activity

		if (container.collection == 'lifestyles'){
			Fireball.set('$lifestyle', container.id);
			ask("Choose an activity that "+container.name+"s do:", ['activities_by_lifestyle', 'all_activities']);
		} else if (container.collection == 'identities'){
			Fireball.set('$identity', container.id);
			ask("Choose an activity that people who are trying to be "+container.name+"s do:", ['activities_by_identity', 'all_activities']);
		} else if (container.collection == 'cities'){
			Fireball.set('$city', container.id);
			ask("Choose an activity that people who live in "+container.name+"s do:", ['activities_by_city', 'all_activities']);
		}
		var activity = yield null;


		// add container if they choose one of the noncontainer set
		ensure_activity_in_container(activity, container);


		ask("When people do "+activity.name+", what are they looking for?", 'time_desires');
		var activity_time_desire = yield null;
		Fireball.set('$desire', activity_time_desire);

		if (activity.is_new){
			ask('How long does '+activity.name+' usually take?', 'activity_durations');
			var activity_duration = yield null;
			activity.id = new_activity(activity.name, activity_time_desire, container, { takes: activity_duration });
		} else {
			if (activity.desires.indexOf(activity_time_desire) < 0){
				activity.desires.push(activity_time_desire);
				F.child('activities').child(activity.id).update({
					desires: activity.desires
				});
			}
		}

		ask("Would you do "+activity.name+" next week, if you could?", 'yes_or_no');
		var would_do = yield null;
		User.would_do(activity.id, would_do)



		// 3. get some add'l info about the activity

		if (container.collection != 'lifestyles'){
			ask("Is there a name for the kind of person who does "+activity.name+"?", 'lifestyles', { escape_hatch: true, auto_add: true });
			var other_container = yield null;
			if (other_container) ensure_activity_in_container(activity, other_container);
		}
		if (container.collection != 'cities'){
			ask("Is there a city in which a lot of people do "+activity.name+"?", 'cities', { escape_hatch: true, auto_add: true });
			var other_container = yield null;
			if (other_container) ensure_activity_in_container(activity, other_container);
		}

		if (container.collection != 'identities'){
			ask("What are people trying to be when they do "+activity.name+"?", 'identities', { escape_hatch: true, auto_add: true });
			var other_container = yield null;
			if (other_container) ensure_activity_in_container(activity, other_container);
		}




		// 4. relate that activity to other activities

		ask("For "+activity_time_desire+", pick an activity you like better than "+activity.name+":", 'activities_by_desire');
		var better_activity = yield null;


		if (container.collection == 'lifestyles'){
			ask("Pick an activity that "+container.name+"s do for "+activity_time_desire+" which you don't like as much as "+activity.name+":", ['activities_by_lifestyle', 'all_activities'], { escape_hatch: true});
		} else if (container.collection == 'cities'){
			ask("Pick an activity that people in "+container.name+"s do for "+activity_time_desire+" which you don't like as much as "+activity.name+":", ['activities_by_city', 'all_activities'], { escape_hatch: true});
		} else if (container.collection == 'identities'){
			ask("Pick an activity that people who want to be "+container.name+"s do for "+activity_time_desire+" which you don't like as much as "+activity.name+":", ['activities_by_identity', 'all_activities'], { escape_hatch: true});
		}
		var worse_activity = yield null;
		if (worse_activity && worse_activity.is_new){
			worse_activity.id = new_activity(worse_activity.name, activity_time_desire, container);
		} else if (worse_activity) {
			ensure_activity_in_container(worse_activity, container);
		}

		if (better_activity.is_new){
			if (container.collection == 'lifestyles'){
				ask('Is '  +better_activity.name+ ' also something that ' + container.name + 's do?', 'yes_or_no');
			} else if (container.collection == 'cities'){
				ask('Is '  +better_activity.name+ ' also something that people in ' + container.name + 's do?', 'yes_or_no');
			} else {
				ask('Is '  +better_activity.name+ ' also something that people who want to be ' + container.name + 's do?', 'yes_or_no');
			}
			var same_container = yield null;

			if (same_container == 'Yes'){
				better_activity.id = new_activity(better_activity.name, activity_time_desire, container);
			} else if (container.collection == 'lifestyles' ){
				ask("What lifestyle does " + better_activity.name  +"?", 'lifestyles', { auto_add: true });
				var better_activity_lifestyle = yield null;
				better_activity.id = new_activity(better_activity.name, activity_time_desire, better_activity_lifestyle);
			} else if (container.collection == 'cities') {
				ask("What city do people do " + better_activity.name  +" in?", 'cities', { auto_add: true });
				var better_activity_city = yield null;
				better_activity.id = new_activity(better_activity.name, activity_time_desire, better_activity_city);
			} else if (container.collection == 'identities') {
				ask("When people do " + better_activity.name  +" what are they trying to be?", 'identities', { auto_add: true });
				var better_activity_identity = yield null;
				better_activity.id = new_activity(better_activity.name, activity_time_desire, better_activity_identity);				
			}
		}

		if (better_activity.id){
			User.thinks_x_is_better_than_y(better_activity, activity);
			if (worse_activity) User.thinks_x_is_better_than_y(activity, worse_activity);			
		}


		// AND play again

		ask("thank you! play again?", 'yes_or_no');
		yield null;
	}
}



Fireball(F, {
	init: function(){
		game = play();
		game.next();
	},

	map: {
		"#lifestyles_list...": 'lifestyles',
		"#identities_list...": 'identities',
		"#cities_list...":     'cities',
		"#activities_by_lifestyle_list...": 'activities_by_lifestyle/$lifestyle',
		"#activities_by_identity_list...": 'activities_by_identity/$identity',
		"#activities_by_city_list...": 'activities_by_city/$city',
		"#activities_by_desire_list...": 'activities_by_desire/$desire',
		"#all_activities_list...": 'activities'
	},

	calculated_fields: {
		"#lifestyles_list how_many_lives": function(lifestyle){
			if (!lifestyle.has_lived) return "";
			if (lifestyle.has_lived[firebase_user_id]) return "You have lived this";
			else return Object.keys(lifestyle.has_lived).length + " have lived this";
		}
	},

	on_click: {
		'#answers div a': function(a){
			if (a.id == 'escape_hatch') return null;
			var data = a.parentNode.data;
			if (!data) return game.next(a.innerText);
			data.is_new = false;
			data.id = a.parentNode.id;
			data.collection = a.parentNode.parentNode.parentNode.id;
			game.next(data);
		},
		'#login': function(a){
			auth.login('facebook', { rememberMe: true });
		}
	},

	on_submit: {
		'form': function(f){
			var v = f.elements[0].value;
			f.elements[0].value = '';
			var data = { name: v, is_new: true, collection: f.parentNode.id };
			if (auto_add){
				if (data.collection == 'lifestyles'){
					data.id = F.child('lifestyles').push({ name: data.name }).name();
				}
				if (data.collection == 'identities'){
					data.id = F.child('identities').push({ name: data.name }).name();
				}
				if (data.collection == 'cities'){
					data.id = F.child('cities').push({ name: data.name }).name();
				}
			}
			game.next(data);
		}
	}
});
