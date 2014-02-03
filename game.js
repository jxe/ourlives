var game, is_new, recent_id, recent_data, auto_add, option_type, fb_id, fb_user_id;
var F = new Firebase('https://lifestyles.firebaseio.com');
var auth = new FirebaseSimpleLogin(F, function(error, user) {
	if (user){
	  fb_user_id = user.uid;
	  fb_id = user.id;
	  $('#login').hide();
	}
});


Fireball(F, {
	map: {
		"#lifestyles_list...": 'lifestyles',
		"#activities_by_lifestyle_list...": 'activities_by_lifestyle/$lifestyle',
		"#activities_by_desire_list...": 'activities_by_desire/$desire'
	},

	on_click: {
		'#answers div a': function(a){
			is_new = false;
			recent_id = a.parentNode.id;
			recent_data = a.parentNode.data;
			game.next(a.innerText);
		},
		'#login': function(a){
			auth.login('facebook', { rememberMe: true });
		}
	},

	on_submit: {
		'form': function(f){
			var v = f.elements[0].value;
			f.elements[0].value = '';
			is_new = true;
			recent_id = null;

			if (auto_add && option_type == 'lifestyles'){
				recent_id = F.child('lifestyles').push({name: v}).name();
			}

			game.next(v);
		}
	}
});



function ask(prompt, options, auto_add_setting, escape_hatch){
	auto_add = auto_add_setting;
	option_type = options;
	$('#prompt').html(prompt);
	$('#answers div').hide();
	if (escape_hatch) $('#escape_hatch').show();
	else $('#escape_hatch').hide();
	if (options) $('#'+options).show();
}


function set_user_lived_lifestyle(lifestyle_id, length_of_time){
	F.child('lifestyles').child(lifestyle_id).child('has_lived').child(fb_user_id).set({
		fb_id: fb_id,
		length_of_time: length_of_time
	});
}

function set_user_would(activity_id, yes_or_no){
	var would = (yes_or_no == "Yes" ? 'would' : 'wouldnot');
	console.log('set_user_would', activity_id, yes_or_no, would);
	F.child('activities').child(activity_id).child(would).child(fb_user_id).set({
		fb_id: fb_id
	});
}

function x_is_better_than_y(x, y, x_name, y_name){
	F.child('activities').child(x).child('better_than').child(fb_user_id).set({
		fb_id: fb_id,
		than: y,
		than_name: y_name
	});
	F.child('activities').child(y).child('worse_than').child(fb_user_id).set({
		fb_id: fb_id,
		than: x,
		than_name: x_name
	});
}

function show_fellow_travelers(lifestyle_data){
	if (!lifestyle_data || !lifestyle_data.has_lived) return;
	var keys = Object.keys(lifestyle_data.has_lived);
	var msg = "<p>"+keys.length+" other people lived this: ";
	keys.forEach(function(k){
		msg += " <img src='https://graph.facebook.com/"+lifestyle_data.has_lived[k].fb_id+"/picture'>";
	});

	document.getElementById('tips').innerHTML += msg;
}

function* play(){
	while(1){
		ask("Pick a lifestyle you've lived", 'lifestyles', true);
		var lifestyle = yield null;
		var lifestyle_id = recent_id;
		Fireball.set('$lifestyle', lifestyle_id);
		if (recent_data) show_fellow_travelers(recent_data);

		if (!recent_data || !recent_data.has_lived || !recent_data.has_lived[fb_user_id]){
			ask("How long did you live as a "+lifestyle+"?", 'lifestyle_timeframes');
			var lifestyle_timeframe = yield null;
			set_user_lived_lifestyle(lifestyle_id, lifestyle_timeframe);			
		}

		ask("Choose an activity that "+lifestyle+"s do:", 'activities_by_lifestyle');
		var activity = yield null;
		var activity_id = recent_id;
		var activity_is_new = is_new;

		ask("When people do "+activity+", what are they looking for?", 'time_desires');
		var activity_time_desire = yield null;
		Fireball.set('$desire', activity_time_desire);

		if (activity_is_new){
			ask('How long does '+activity+' usually take?', 'activity_durations');
			var activity_duration = yield null;

			activity_id = F.child('activities').push({
				name: activity,
				lifestyles: [ lifestyle_id ],
				desires: [ activity_time_desire ],
				takes: activity_duration
			}).name();
		} else {
			// TODO: add activity_time_desire to list of indexed desires if it's not there...
		}

		ask("Would you do "+activity+" next week, if you could?", 'yes_or_no');
		var would_do = yield null;
		set_user_would(activity_id, would_do)

		ask("For "+activity_time_desire+", pick an activity you like better than "+activity+":", 'activities_by_desire');
		var better_activity = yield null;
		var better_activity_id = recent_id;
		var better_activity_is_new = is_new;

		ask("Pick an activity that "+lifestyle+"s do for "+activity_time_desire+" which you don't like as much as "+activity+":", 'activities_by_lifestyle', false, true);
		var worse_activity = yield null;
		var worse_activity_id = recent_id;
		if (worse_activity != "Can't think of one" && is_new){
			worse_activity_id = F.child('activities').push({
				name: worse_activity,
				lifestyles: [ lifestyle_id ],
				desires: [ activity_time_desire ]
			}).name();
		}

		if (better_activity_is_new){
			ask('Is '  +better_activity+ ' also something that ' + lifestyle + 's do?', 'yes_or_no');
			var same_lifestyle = yield null;

			if (same_lifestyle == 'Yes'){
				better_activity_id = F.child('activities').push({
					name: better_activity,
					lifestyles: [ lifestyle_id ],
					desires: [ activity_time_desire ]
				}).name();
			} else {
				ask("What lifestyle does " + better_activity  +"?", 'lifestyles', true);
				var better_activity_lifestyle = yield null;
				var better_activity_lifestyle_id = recent_id;
				better_activity_id = F.child('activities').push({
					name: better_activity,
					lifestyles: [ better_activity_lifestyle_id ],
					desires: [ activity_time_desire ]
				}).name();
			}
		}

		x_is_better_than_y(better_activity_id, activity_id, better_activity, activity);
		if (worse_activity != "Can't think of one"){
			x_is_better_than_y(activity_id, worse_activity_id, activity, worse_activity);
		}

		ask("thank you! play again?", 'yes_or_no');
		yield null;
	}
}

game = play();
game.next();
