var CubeLoader = new THREE.CubeTextureLoader();
var texturePromises = {};
initColladaModels();


function setPos (x,y,z) {
  tie.setAttribute('position', {
    x: x,
    y: y,
    z: z
  });
}

function initColladaModels(){
  document.addEventListener('model-loaded', function (evt) {
    console.log(evt.target.id);
    console.log(evt.target.object3D);
    if(evt.target.id == "tie"){
      // setTimeout(function(){
        
      // },2000)
      console.log("Ship loaded");
      var ship = evt.target.object3D.children[0].children[0].children[0];
      ship.geometry.computeVertexNormals();
      // make it shiny
      for(var i=0;i<ship.material.materials.length;i++){
        ship.material.materials[i].specular = {r:0.2,g:0.2,b:0.25};
        if(ship.material.materials[i].name == "RRSilver") 
          ship.material.materials[i].specular = {r:0.3,g:0.3,b:0.4};
      }
    }else if(evt.target.id == "throttle-handle"){
      var throttleHandle = evt.target.object3D.children[0].children[0].children[0];
      // console.log(evt.target.object3D.children[0].children[0]);
      // throttleHandle.geometry.computeVertexNormals();
    }else if(evt.target.id == "driver"){
      var driver = evt.target.object3D.children[2].children[1].children[0];
      console.log(driver);
      console.log(driver.geometry.animation);
      // var animation = new THREE.Animation( driver, driver.geometry.animation );
      // var kfAnimation = new THREE.KeyFrameAnimation( driver.geometry.animation );
      // animation.play();
    }
  });
}

// groupObject3D = document.querySelector('#tie').object3D;
// groupObject3D.position.x=49
// groupObject3D.position.y=0
// groupObject3D.position.z=-100
// var ship = document.querySelector('#tie').object3D;
// ship.scale.multiplyScalar(2);
// ship.position.x = 0.17;
// ship.position.y = 1.1;
// ship.position.z = 0.25;

/**
 * Builds and normalize material data, normalizing stuff along the way.
 *
 * @param {object} data - Material data.
 * @returns {object} data - Processed material data.
 */
function getMaterialData (data) {
  var newData = {
    color: new THREE.Color(data.color),
    fog: data.fog,
    metalness: data.metalness,
    roughness: data.roughness,
	speedvector: data.speedvector,
	dopplerTerm: data.dopplerTerm,
	dopplerTwine: data.dopplerTwine,
	dopplerIrPrefactor: data.dopplerIrPrefactor,
	dopplerHueAngleFix: data.dopplerHueAngleFix
  };

  if (data.normalMap) { newData.normalScale = data.normalScale; }

  if (data.ambientOcclusionMap) { newData.aoMapIntensity = data.ambientOcclusionMapIntensity; }

  if (data.displacementMap) {
    newData.displacementScale = data.displacementScale;
    newData.displacementBias = data.displacementBias;
  }

  return newData;
}

/**
 * Standard (physically-based) shader using THREE.MeshStandardMaterial.
 */
AFRAME.registerShader('hello-relativistic-world-shader', {
  schema: {
    ambientOcclusionMap: {default: ''},
    ambientOcclusionMapIntensity: {default: 1},
    ambientOcclusionTextureOffset: {default: ''},
    ambientOcclusionTextureRepeat: {default: ''},

    color: {type: 'color'},

    displacementMap: {default: ''},
    displacementScale: {default: 1},
    displacementBias: {default: 0.5},
    displacementTextureOffset: {default: ''},
    displacementTextureRepeat: {default: ''},
    envMap: {default: ''},

    fog: {default: true},
    height: {default: 256},
    metalness: {default: 0.0, min: 0.0, max: 1.0},

    normalMap: {default: ''},
    normalScale: {type: 'vec2', default: '1 1'},
    normalTextureOffset: {default: ''},
    normalTextureRepeat: {default: ''},

    repeat: {default: ''},
    roughness: {default: 0.5, min: 0.0, max: 1.0},
    sphericalEnvMap: {default: ''},
    src: {default: ''},
    width: {default: 512},
	
	speedvector: {
      type: 'vec3',
      default: { x: 0.001, y: 0, z: 0 }
    },
    
    dopplerTerm: { default:4.0 / 3.0 },
    dopplerTwine: { default:1.0 },
    dopplerIrPrefactor: { default:14.0 / 75.0 },
    dopplerHueAngleFix: { default: 0.0 },
    
  },
   

  /**
   * Initializes the shader.
   * Adds a reference from the scene to this entity as the camera.
   */
  init: function (data) {
    this.material = new MyMaterial(getMaterialData(data));
    AFRAME.utils.material.updateMap(this, data);
    if (data.normalMap) { AFRAME.utils.material.updateDistortionMap('normal', this, data); }
    if (data.displacementMap) { AFRAME.utils.material.updateDistortionMap('displacement', this, data); }
    if (data.ambientOcclusionMap) { AFRAME.utils.material.updateDistortionMap('ambientOcclusion', this, data); }
    this.updateEnvMap(data);
  },

  update: function (data) {
    this.updateMaterial(data);
    AFRAME.utils.material.updateMap(this, data);
    if (data.normalMap) { AFRAME.utils.material.updateDistortionMap('normal', this, data); }
    if (data.displacementMap) { AFRAME.utils.material.updateDistortionMap('displacement', this, data); }
    if (data.ambientOcclusionMap) { AFRAME.utils.material.updateDistortionMap('ambientOcclusion', this, data); }
    this.updateEnvMap(data);
  },

  /**
   * Updating existing material.
   *
   * @param {object} data - Material component data.
   * @returns {object} Material.
   */
  updateMaterial: function (data) {
    var material = this.material;
    data = getMaterialData(data);
    Object.keys(data).forEach(function (key) {
      material[key] = data[key];
    });
  },

  /**
   * Handle environment cubemap. Textures are cached in texturePromises.
   */
  updateEnvMap: function (data) {
    var self = this;
    var material = this.material;
    var envMap = data.envMap;
    var sphericalEnvMap = data.sphericalEnvMap;

    // No envMap defined or already loading.
    if ((!envMap && !sphericalEnvMap) || this.isLoadingEnvMap) {
      material.envMap = null;
      material.needsUpdate = true;
      return;
    }
    this.isLoadingEnvMap = true;

    // if a spherical env map is defined then use it.
    if (sphericalEnvMap) {
      this.el.sceneEl.systems.material.loadTexture(sphericalEnvMap, { src: sphericalEnvMap }, function textureLoaded (texture) {
        self.isLoadingEnvMap = false;
        texture.mapping = THREE.SphericalReflectionMapping;
        material.envMap = texture;
        utils.material.handleTextureEvents(self.el, texture);
        material.needsUpdate = true;
      });
      return;
    }

    // Another material is already loading this texture. Wait on promise.
    if (texturePromises[envMap]) {
      texturePromises[envMap].then(function (cube) {
        self.isLoadingEnvMap = false;
        material.envMap = cube;
        utils.material.handleTextureEvents(self.el, cube);
        material.needsUpdate = true;
      });
      return;
    }

    // Material is first to load this texture. Load and resolve texture.
    texturePromises[envMap] = new Promise(function (resolve) 
	{
      AFRAME.utils.srcLoader.validateCubemapSrc(envMap, function loadEnvMap (urls) 
	  {
        CubeLoader.load(urls, function (cube) 
		{
          // Texture loaded.
          self.isLoadingEnvMap = false;
          material.envMap = cube;
          utils.material.handleTextureEvents(self.el, cube);
          resolve(cube);
        });
      });
    });
  },

});