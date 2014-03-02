// firewidget.js




// tinywidgets


(function(){
	var subs = {}, sub_scope, domains = {};
	window.firewidget = function(a, b){
		if (!a.trim) { for (var x in a) firewidget(x, a[x]); return; }
		firewidget.unsub(sub_scope = a);
		var el = document.getElementById(a) || document.querySelector(a) || alert(a + " not found.");
		if (!b || !b.sort) b = [b];
		for (var i = el.classList.length - 1; i >= 0; i--) {
			var c = firewidget.widgets[ el.classList[i] ];
			if (c) c(el, b[0], b[1], b[2], b[3], b[4]);
		};
	};
	firewidget.sub = function(ref, ev, f){
		if (!subs[sub_scope]) subs[sub_scope] = [];
		subs[sub_scope].push(function(){ ref.off ? ref.off(ev,f) : ref.removeEventListener(ev,f); });
		ref.on ? ref.on(ev, f) : ref.addEventListener(ev, f);
	}
	firewidget.unsub = firewidget.close = function(scope){
		if (!scope) scope = Object.keys(subs);
		if (scope.forEach) scope.forEach(function(s){ firewidget.unsub(s); });
		if (subs[scope]) subs[scope].forEach(function(sub){ sub(); });
		delete subs[scope];
	};
	firewidget.reveal = function(domain, id, wires){
		var elements = document.querySelectorAll(domain);
		Array.prototype.forEach.call(elements, function(el){ el.style.display = 'none'; });
		document.getElementById(id).style.display = 'block';
		if (domains[domain]) firewidget.unsub(domains[domain]);
		domains[domain] = Object.keys(wires || {});
		if (wires) firewidget(wires);
	};
	firewidget.widgets = {
		simple_label: function(el, value){
			el.innerHTML = value;
		},
		simple_input: function(el, onchange){
			firewidget.sub(el.form, 'submit', function(ev){ onchange(el.value); ev.preventDefault(); el.value = ''; return false; });
		}
	};
})();






// tinytemplate

function mikrotemplate(el, obj_or_array, id_pfx){
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
	function decorate_subtree(el, json){
		el.data = json;
		decorate_element(el, json);
		var matches = el.querySelectorAll('[data-set]');
		for (var i = 0; i < matches.length; i++) decorate_element(matches[i], json);
	}
	if (!id_pfx) id_pfx = '';
	if (!obj_or_array) return;
	if (!obj_or_array.forEach) return decorate_subtree(el, obj_or_array);
	if (!mikrotemplate.templates) mikrotemplate.templates = {};
	if (!mikrotemplate.templates[el.id]) mikrotemplate.templates[el.id] = el.firstElementChild.cloneNode(true);
	el.innerHTML = "";
	obj_or_array.forEach(function(o){
		var clone = mikrotemplate.templates[el.id].cloneNode(true);
		clone.id = id_pfx + o.id;
		decorate_subtree(clone, o);
		el.appendChild(clone);
	});
}




// tinyfire



(function(){
	var sub = firewidget.sub, w = firewidget.widgets;

	function values(obj){
		if (!obj) return [];
		return Object.keys(obj).map(function(x){ obj[x].id = x; return obj[x]; });
	}

	w.fbobjlist = function(el, ref, onclick, calcfns, id_pfx){
		if (!id_pfx) id_pfx = '';
		sub(ref, 'value', function(snap){
			var value = snap.val();
			var array = value ? values(value) : [];
			if (calcfns) array.forEach(function(o){
				for (var k in calcfns){
					o[k] = calcfns[k](o, function(v){
						var item = document.getElementById(id_pfx + o.id);
						o[k] = v;
						console.log(item, v, o);
						mikrotemplate(item, o, id_pfx);
					});
				}
			});
			mikrotemplate(el, array, id_pfx);
			if (!onclick) return;
			var children = el.childNodes;
			for (var i = children.length - 1; i >= 0; i--) {
				children[i].onclick = function(ev){ onclick( this.data, ev, this ); };
			}
		});
	};



	w.fbtablist = function(el, ref_options, ref_selected, onchange){
		// if (!id_pfx) id_pfx = '';
		function select_item(parent, child){
			var prev_selected = parent.querySelectorAll('.selected');
			Array.prototype.forEach.call(prev_selected, function(x){ x.setAttribute('class', ''); });
			child.setAttribute('class', 'selected');			
		}
		sub(ref_options, 'value', function(snap){
			var value = snap.val();
			var array = value ? values(value) : [];
			mikrotemplate(el, array);
			var children = el.childNodes;
			for (var i = children.length - 1; i >= 0; i--) {
				children[i].onclick = function(ev){
					select_item(el, this);
					if (ref_selected) ref_selected.set(this.data);
					if (onchange) onchange(this.data);
				};
			}
			sub(ref_selected, 'value', function(snap){
				var v = snap.val();
				if (v){
					var to_select = document.getElementById(v.id || v);
					if (to_select) select_item(el, to_select);			
				}
				if (onchange) onchange(v);
			});
		});
	};



	w.fbselectlist = function(el, ref_selected, ref_options, onchange){
		sub(ref_options, 'value', function(snap){
			var value = snap.val();
			var array = value ? values(value) : [];
			mikrotemplate(el, array);

			sub(ref_selected, 'value', function(snap){
				var v = snap.val();
				$(el).val(v);
				if (onchange) onchange(v);
			});			
		});
		sub($(el), 'change', function(ev){
			if (!this.value) ref_selected.remove();
			else ref_selected.set(this.value);
			if (onchange) onchange(this.value);
		});
	};


	w.fbselect = function(el, ref, onchange){
		sub(ref, 'value', function(snap){
			var v = snap.val();
			$(el).val(v);
			if (onchange) onchange(v);
		});
		sub($(el), 'change', function(ev){
			if (!this.value) ref.remove();
			else ref.set(this.value);
			if (onchange) onchange(this.value);
		});
	};


	// requires jquery and the twitter typeahead.js thing
	w.fbtypeahead = function(el, ref, onchange){
		var options = [];

		sub(ref, 'value', function(snap){
			options = values(snap.val());
			console.log(el.id, "typeahead got values", options);
		});

		sub($(el.form), 'submit', function(ev){
			ev.preventDefault();
			onchange({ name: el.value });
			$(el).typeahead('val', '');
			return false;
		});

		sub($(el), 'typeahead:selected', function(ev, data){
			onchange(data);
			$(el).typeahead('val', '');
		});

		$(el).typeahead('destroy');
		$(el).typeahead({autoselect:true}, {
		  displayKey: 'name',
		  source: function(query, cb){
			var q = query && query.toLowerCase();
			cb(options.filter(function(x){
				return !query || (x.name&&x.name.toLowerCase().indexOf(q) >= 0);
			}));
		  }
		});
		$(el).typeahead('val', '');
	};

})();
