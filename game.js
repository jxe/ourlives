var game, is_new, recent_id, auto_add, option_type, fb_id;

function ask(prompt, options, auto_add_setting){
	auto_add = auto_add_setting;
	option_type = options;
	$('#prompt').html(prompt);
	$('#answers div').hide();
	if (options) $('#'+options).show();
}

var F = new Firebase('https://lifestyles.firebaseio.com');
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
			game.next(a.innerText);
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



function set_user_lived_lifestyle(lifestyle_id, length_of_time){
	// todo
}

function set_user_would(activity_id, yes_or_no){
	// todo
}



function* play(){
	while(1){
		ask("Pick a lifestyle you've lived", 'lifestyles', true);
		var lifestyle = yield null;
		var lifestyle_id = recent_id;
		Fireball.set('$lifestyle', lifestyle_id);

		ask("How long did you live as a "+lifestyle+"?", 'lifestyle_timeframes');
		var lifestyle_timeframe = yield null;
		set_user_lived_lifestyle(lifestyle_id, lifestyle_timeframe);

		ask("Choose an activity that "+lifestyle+"s do:", 'activities_by_lifestyle');
		var activity = yield null;
		var activity_id = recent_id;
		var activity_is_new = is_new;

		ask("When people do "+activity+", what are they looking for?", 'time_desires');
		var activity_time_desire = yield null;
		Fireball.set('$desire', activity_time_desire);

		if (is_new){
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
		var better_activity_is_new = is_new;

		ask("For "+activity_time_desire+", pick an activity that "+lifestyle+"s do for "+activity_time_desire+" which you don't like as much as "+activity+":", 'activities_by_lifestyle');
		var worse_activity = yield null;
		if (is_new){
			F.child('activities').push({
				name: worse_activity,
				lifestyles: [ lifestyle_id ],
				desires: [ activity_time_desire ]
			});
		}

		if (better_activity_is_new){
			ask('Is '  +better_activity+ ' also something that ' + lifestyle + 's do?', 'yes_or_no');
			var same_lifestyle = yield null;

			if (same_lifestyle == 'Yes'){
				F.child('activities').push({
					name: better_activity,
					lifestyles: [ lifestyle_id ],
					desires: [ activity_time_desire ]
				});
			} else {
				ask("What lifestyle does " + better_activity  +"?", 'lifestyles', true);
				var better_activity_lifestyle = yield null;
				var better_activity_lifestyle_id = recent_id;
				F.child('activities').push({
					name: better_activity,
					lifestyles: [ better_activity_lifestyle_id ],
					desires: [ activity_time_desire ]
				});
			}
		}

		ask("thank you! play again?", 'yes_or_no');
		yield null;
	}
}

game = play();
game.next();
