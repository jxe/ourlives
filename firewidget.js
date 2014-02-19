// firewidget.js




// tinywidgets


window.firewidget = (function(){
	var subs = {};
	function sub(ref, ev, f){ 
		if (!subs[sub_scope]) subs[sub_scope] = []; 
		subs[sub_scope].push(function(){ ref.off(ev,f); });
		ref.on(ev, f); 
	}
	function unsub(scope){
		if (!scope) Object.keys(subs).forEach(function(s){ unsub(s); });
		if (!subs[scope]) return;
		subs[scope].forEach(function(sub){ sub(); });
		delete subs[scope];
	}
	function firewidget(a, b){
		if (!b) { for (var x in a) firewidget(x, a[x]); return; }
		if (a.trim) {
			unsub(sub_scope = a);
			a = document.getElementById(a) || document.querySelector(a) || alert(a + " not found.");
		}
		if (!b.sort) b = [b];
		for (var i = a.classList.length - 1; i >= 0; i--) {
			var configurer = firewidget.widgets[ a.classList[i] ];
			if (configurer) configurer(a, b[0], b[1], b[2], b[3]);
		};
	};
	firewidget.sub = sub;
	firewidget.close = unsub;
	firewidget.widgets = {
		simple_label: function(el, value){ el.innerHTML = value; },
		simple_input: function(el, onchange){
			sub($(el.form), 'submit', function(ev){ onchange(el.value); el.value = ''; return false; });
		}
	};
	return firewidget;
})();








// tinytemplate

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




// tinyfire


Object.values = function(obj){
	if (!obj) return [];
	return Object.keys(obj).map(function(x){ obj[x].id = x; return obj[x]; });
}

var templates = {};
var sub = firewidget.sub;

firewidget.widgets.fbobjlist = function(el, ref, onclick){
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

firewidget.widgets.fbtypeahead = function(el, ref, onchange){
	var options = [];

	sub(ref, 'value', function(snap){
		options = Object.values(snap.val());
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

firewidget.widgets.fbselect = function(el, ref, onchange){
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
