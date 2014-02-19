var game, auto_add, info = {};
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

		info = {};

		// 1. pick or add a lifestyle

		ask("Pick a lifestyle you've lived, a city you've lived in, or a thing you're trying to be:", ['lifestyles', 'cities', 'identities'], { hide_reset: true });
		var container = info.container = yield null;

		if (!container.collection){
			ask('What kind of thing is "'+container.name+'"?', 'things');
			var type_of_container = yield null;
			if (type_of_container.match(/lifestyle/)){
				container.collection = 'lifestyles';
			} else if (type_of_container.match(/city/)){
				container.collection = 'cities';
			} else {				
				container.collection = 'identities';
			}
			container.id = F.child(container.collection).push({ name: container.name }).name();
		}

		if (container.collection == 'lifestyles'){
			yield *ask_about_lifestyle(container);
		}

		// 2. pick or add an activity

		if (container.collection == 'lifestyles'){
			ask("Choose an activity that %ns do:", ['activities']);
		} else if (container.collection == 'identities'){
			ask("Choose an activity that people who are trying to be %n do:", ['activities']);
		} else if (container.collection == 'cities'){
			ask("Choose an activity that people who live in %n do:", ['activities']);
		}
		var activity = info.activity = yield null;



		ask("When people do %a, what are they looking for?", 'time_desires');
		var activity_time_desire = info.desire = yield null;

		if (activity.is_new){
			ask('How long does %a usually take?', 'activity_durations');
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

		// add container if they choose one of the noncontainer set
		ensure_activity_in_container(activity, container);

		ask("Would you do %a next week, if you could?", 'yes_or_no');
		var would_do = yield null;
		User.would_do(activity.id, would_do)



		// 3. get some add'l info about the activity

		if (container.collection != 'lifestyles'){
			ask("Is there a name for the kind of person who does %a?", ['lifestyles'], { can_skip: true });
			var other_container = yield null;
			if (other_container) ensure_activity_in_container(activity, other_container);
		}
		if (container.collection != 'cities'){
			ask("Is there a city where many people do %a?", ['cities'], { can_skip: true });
			var other_container = yield null;
			if (other_container) ensure_activity_in_container(activity, other_container);
		}

		if (container.collection != 'identities'){
			ask("What are people trying to be when they do %a?", ['identities'], { can_skip: true });
			var other_container = yield null;
			if (other_container) ensure_activity_in_container(activity, other_container);
		}




		// 4. relate that activity to other activities

		ask("For %d, pick an activity you like better than %a:", ['activities']);
		var better_activity = yield null;


		if (container.collection == 'lifestyles'){
			ask("Choose an activity you don't like as much as %a, but that %ns do for %d:", ['activities'], { can_skip: true});
		} else if (container.collection == 'cities'){
			ask("Choose an activity you don't like as much as %a, but that people in %n do for %d:", ['activities'], { can_skip: true});
		} else if (container.collection == 'identities'){			
			ask("Choose an activity you don't like as much as %a, but that people who want to be %n do for %d:", ['activities'], { can_skip: true});
		}
		var worse_activity = yield null;
		if (worse_activity && worse_activity.is_new){
			worse_activity.id = new_activity(worse_activity.name, activity_time_desire, container);
		} else if (worse_activity) {
			ensure_activity_in_container(worse_activity, container);
		}

		if (better_activity.is_new){
			if (container.collection == 'lifestyles'){
				ask('Is '  +better_activity.name+ ' also something that %ns do?', 'yes_or_no');
			} else if (container.collection == 'cities'){
				ask('Is '  +better_activity.name+ ' also something that people in %n do?', 'yes_or_no');
			} else {
				ask('Is '  +better_activity.name+ ' also something that people who want to be %n do?', 'yes_or_no');
			}
			var same_container = yield null;

			if (same_container == 'Yes'){
				better_activity.id = new_activity(better_activity.name, activity_time_desire, container);
			} else if (container.collection == 'lifestyles' ){
				ask("What lifestyle does " + better_activity.name  +"?", ['lifestyles']);
				var better_activity_lifestyle = yield null;
				better_activity.id = new_activity(better_activity.name, activity_time_desire, better_activity_lifestyle);
			} else if (container.collection == 'cities') {
				ask("What city do people do " + better_activity.name  +" in?", ['cities']);
				var better_activity_city = yield null;
				better_activity.id = new_activity(better_activity.name, activity_time_desire, better_activity_city);
			} else if (container.collection == 'identities') {
				ask("When people do " + better_activity.name  +" what are they trying to be?", ['identities']);
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




$(function(){
	game = play();
	game.next();
});
