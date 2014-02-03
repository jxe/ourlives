window.facebook_id = null;
window.firebase_user_id = null;
window.F = new Firebase('https://lifestyles.firebaseio.com');
window.User = {
	add_to_inventory: function(lifestyle){
		if (!lifestyle || !lifestyle.has_lived) return;
		var keys = Object.keys(lifestyle.has_lived);
		var msg = "<p>"+keys.length+" other people lived this: ";
		keys.forEach(function(k){
			msg += " <img src='https://graph.facebook.com/"+lifestyle.has_lived[k].fb_id+"/picture'>";
		});
		document.getElementById('tips').innerHTML += msg;
	},

	lived_lifestyle: function(lifestyle, length_of_time){
		F.child('lifestyles').child(lifestyle.id).child('has_lived').child(firebase_user_id).set({
			fb_id: facebook_id,
			length_of_time: length_of_time
		});
		if (!lifestyle.is_new) User.add_to_inventory(lifestyle);
	},

	would_do: function(activity_id, yes_or_no){
		if (!firebase_user_id) { alert('Please log in!'); return; }
		var would = (yes_or_no == "Yes" ? 'would' : 'wouldnot');
		F.child('activities').child(activity_id).child(would).child(firebase_user_id).set({
			fb_id: facebook_id
		});
	},

	thinks_x_is_better_than_y: function(x, y){
		F.child('activities').child(x.id).child('better_than').child(y.id).child(firebase_user_id).set({
			fb_id: facebook_id,
			than_name: y.name
		});
		F.child('activities').child(y.id).child('worse_than').child(x.id).child(firebase_user_id).set({
			fb_id: facebook_id,
			than_name: x.name
		});
	}
}
