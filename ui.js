$('#login').on('click', function(){ auth.login('facebook', { rememberMe: true }); });
$('#reset').on('click', function(){ try{ game.throw(new Error()); } catch(Error) {}; game = play(); game.next(); });


function all_options_updated(){
	var summary = '';
	if (all_typeahead_options.lifestyles){
		summary += "<p><b>Lifestyles:</b> " + all_typeahead_options.lifestyles.map(function(x){ return x.name; }).join(', ');
	}
	if (all_typeahead_options.cities){
		summary += "<p><b>Cities:</b> " + all_typeahead_options.cities.map(function(x){ return x.name; }).join(', ');
	}
	if (all_typeahead_options.identities){
		summary += "<p><b>Trying to be:</b> " + all_typeahead_options.identities.map(function(x){ return x.name; }).join(', ');
	}
	$('#summary_text').html(summary);
}


var typeahead_options = {};
var all_typeahead_options = {};

function ask(prompt, menu_type, options){
	if (!options) options = {};
	$('#answers div').hide();
	$('form').hide();

	if (options.can_skip) $('#skip').show();
	else $('#skip').hide();

	if (options.hide_reset) $('#reset').hide();
	else $('#reset').show();

	prompt = prompt.replace(/%n/g, function() { return info.container.name; });
	prompt = prompt.replace(/%a/g, function() { return info.activity.name; });
	prompt = prompt.replace(/%d/g, function() { return info.desire; });
	$('#prompt').html(prompt);

	if (menu_type.map){
		// it's an array, so show the typeahead populated by firebase_paths
		var paths = menu_type;
		$('#typeahead').typeahead('val', '');
		$('form').show();

		typeahead_options = {};
		paths.forEach(function(p){
			F.child(p).once('value', function(snap){
				var options = values(snap.val());
				options.forEach(function(v){ v.collection = p; });
				typeahead_options[p] = all_typeahead_options[p] = options;
				all_options_updated();
			});
		});

	} else {
		// just show an options div
		$('#'+menu_type).show();

	}
	return null;
}

$('#answers div').hide();
$('#skip').on('click', function(){ game.next(null); });

$('#answers div a').on('click', function(){
	var a = this;
	if (a.id == 'skip') return game.next(null);
	return game.next(a.innerText);
});


// util fn
function values(obj){
	return Object.keys(obj).map(function(x){ obj[x].id = x; return obj[x]; });
}


$('#typeahead').typeahead({autoselect:true}, {
  displayKey: 'name',
  source: function(query, cb){
  	var typeahead_option_arrays = values(typeahead_options);
	var options = Array.prototype.concat.apply([], typeahead_option_arrays);
	var q = query && query.toLowerCase();
	cb(options.filter(function(x){
		return !query || x.name.toLowerCase().indexOf(q) >= 0;
	}));
  }
}).on('typeahead:selected', function(ev, data){
	data.is_new = false;
	game.next(data);
	$('#typeahead').typeahead('val', '');
});

$('form').on('submit', function(ev){
	var input = this.typeahead;
	var v = input.value;
	$('#typeahead').typeahead('val', '');
	// input.value = '';
	var collections = Object.keys(typeahead_options);
	var collection;
	if (collections.length == 1) collection = collections[0];
	var data = { name: v, is_new: true, collection: collection };
	if (collection == 'lifestyles'){
		data.id = F.child('lifestyles').push({ name: v }).name();
	}
	if (collection == 'identities'){
		data.id = F.child('identities').push({ name: v }).name();
	}
	if (collection == 'cities'){
		data.id = F.child('cities').push({ name: v }).name();
	}
	ev.preventDefault();
	game.next(data);
	return false;
});
