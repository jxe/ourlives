function ask(prompt, menu_type, options){
	if (!options) options = {};
	auto_add = options.auto_add;
	$('#prompt').html(prompt);
	$('#answers div').hide();
	if (options.escape_hatch) $('#escape_hatch').show();
	else $('#escape_hatch').hide();
	if (menu_type && menu_type.forEach) menu_type.forEach(function(x){ $('#'+x).show(); });
	else if (menu_type) $('#'+menu_type).show();
	return null;
}
