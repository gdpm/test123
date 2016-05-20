module.exports = function(grunt) {

	var angularDir = 'angular/';
	var cssDir = 'css/';
	var libsDir = 'libs/';
	
	
	
	grunt.initConfig({
		concat:{
			js:{
				src: [angularDir + 'app.js', 'templates.js', angularDir + 'dataService.js'],
				dest: 'public/jsconcat.js'
			},
			css:{
				src: [cssDir + 'bootstrap.min.css', cssDir + 'mainpage.min.css'],
				dest: 'public/cssconcat.css'
			},
			libs:{
				src: [
				libsDir + 'jquery.min.js',
				libsDir + 'angular.min.js',
				libsDir + 'angular-animate.min.js',
				libsDir + 'angular-ui-router.min.js',
				libsDir + 'bootstrap.min.js',
				libsDir + 'raphael-2.1.4.min.js',
				libsDir + 'justgage.js'
				],
				dest: 'public/libsconcat.js'
			}
		},
		
		ngtemplates:{
			app: {
				src: ['stage1.html', 'stage2.html'],
				dest: 'templates.js'
			}
		},
		
		uglify: {
			options: {
			  mangle: true
			},
			app: {
			  files: {
				'public/jsconcat.js': ['public/jsconcat.js']
			  }
			}
	  },
		  babel: {
			options: {
				sourceMap: false,
				presets: ['es2015']
			},
			files: {
				expand: true,
				cwd: 'public',
				ext: '.js',
				src: ['jsconcat.js'],
				dest: 'public'
			}
		},
		ngAnnotate: {
			options: {
				singleQuotes: true
			},
			app: {
				files: {
					'public/jsconcat.js': ['public/jsconcat.js']
				}
			}
		},
		cssmin: {
		   app: {
			  files: {
				 'css/mainpage.min.css': ['css/mainpage.css']
			  }
		  }
		}
		
	});
	
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-angular-templates');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-babel');
	grunt.loadNpmTasks('grunt-ng-annotate'); 
	
	grunt.registerTask('build', ['ngtemplates', 'concat', 'ngAnnotate', 'babel','cssmin', 'uglify']);

}