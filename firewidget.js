// firewidget.js

function values(obj){
	if (!obj) return [];
	return Object.keys(obj).map(function(x){ obj[x].id = x; return obj[x]; });
}

function template_set(json, dom){
	function decorate_element(el, json){
		var directives = el.getAttribute('data-set') ? el.getAttribute('data-set').split(' ') : [];
		directives.forEach(function(word){
	   		var parts = word.split(':');
	   		var attr = parts[0];
	   		var path = parts[1] || parts[0];
			if (attr == 'text')       el.innerHTML = json[path];
			else if (attr == 'value') el.value = json[path];
			else el.setAttribute(attr, json[path]);
		});
	}
	if (!json) json = {};
	decorate_element(dom, json);
	var matches = dom.querySelectorAll('[data-set]');
	for (var i = 0; i < matches.length; i++) decorate_element(matches[i], json);
	return dom;
}


window.firewidget = (function(){
	var templates = {}, subs = [], w = {};
	function sub(ref, ev, f){ subs.push(function(){ ref.off(ev,f); }); ref.on(ev, f); }

	w.fbobjlist = function(el, ref, onclick){
		sub(ref, 'value', function(snap){
			var value = snap.val();
			if (!templates[el.id]) templates[el.id] = el.firstElementChild.cloneNode(true);
			el.innerHTML = "";
			if (!value) return;
			var doms = [];
			for (var k in value){
				var o = value[k];
				if (!o.id) o.id = k;
				var clone = templates[el.id].cloneNode(true);
				clone.data = o;
				clone.id = o.id;
				clone.onclick = function(){ onclick( this.data ); };
				doms.push(template_set(o, clone));
			}
			doms.forEach(function(dom){ el.appendChild(dom); });
		});
	};
	
	w.fbtypeahead = function(el, ref, onchange){
		var options = [];

		sub(ref, 'value', function(snap){
			options = values(snap.val());
		});

		sub($(el.form), 'submit', function(ev){
			ev.preventDefault();
			onchange({ name: el.value, is_new: true });
			$(el).typeahead('val', '');
			return false;
		});

		sub($(el), 'typeahead:selected', function(ev, data){
			onchange(data);
			$(el).typeahead('val', '');
		});

		$(el).typeahead({autoselect:true}, {
		  displayKey: 'name',
		  source: function(query, cb){
			var q = query && query.toLowerCase();
			cb(options.filter(function(x){
				return !query || x.name.toLowerCase().indexOf(q) >= 0;
			}));
		  }
		});
		$(el).typeahead('val', '');
	};

	w.fbselect = function(el, ref, onchange){
		sub(ref, 'value', function(snap){
			var v = snap.val();
			$(el).val(v);
			if (onchange) onchange(v);
		});
		sub($(el), 'change', function(ev){
			ref.set(this.value);
			if (onchange) onchange(this.value);
		});
	};

	w.simple_input = function(el, onchange){
		sub($(el.form), 'submit', function(ev){
			onchange(el.value);
			el.value = '';
			return false;
		});
	};

	w.simple_label = function(el, value){
		el.innerHTML = value;
	};



	function firewidget(a, b){
		if (!b) { subs = []; for (var x in a) firewidget(x, a[x]); return subs; }
		if (a.trim) a = document.getElementById(a) || document.querySelector(a) || alert(a + " not found.");
		if (!b.sort) b = [b];
		for (var i = a.classList.length - 1; i >= 0; i--) {
			var configurer = w[ a.classList[i] ];
			if (configurer) configurer(a, b[0], b[1], b[2], b[3]);
		};
	};

	firewidget.close = function(subs){
		subs.forEach(function(sub){ sub(); });
	};

	return firewidget;
})();
