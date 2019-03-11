import React, { Component } from 'react';
import GoogleMapReact from 'google-map-react';
import MarkerClusterer from "@google/markerclusterer"
import SearchBox from './SearchBox';
import './style.css'
import './newstyle.css'
import axios from "axios"
import { Row, Col } from 'reactstrap';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isActiveModal: false,
      mapApiLoaded: false,
      mapInstance: null,
      mapApi: null,
      places: [],
      center: {
        lat: 52.070499,
        lng: 4.3007
      },
      zoom: 13,
      placeName: "",
      showInfo: false,
      markerInfo: {},
      maxThershold: 0,
      minThreshold: 0,
      totalUsed: 0,
      occupiedCount: 0,
      radius: 10,
      selectedCategory: [
        { id: 1, isSelected: true, icon: "disabled" },
        { id: 2, isSelected: false, icon: "electric" },
        { id: 3, isSelected: false, icon: "pickup" },
        { id: 4, isSelected: true, icon: "public" },
        { id: 5, isSelected: false, icon: "taxi" },
        { id: 6, isSelected: false, icon: "touringbus" },
        { id: 7, isSelected: false, icon: "truck" },
        { id: 8, isSelected: false, icon: "valet" },
        { id: 9, isSelected: false, icon: "google" }
      ],
      allMarkers: [],
      markerCluster: {}
    };
    // this.state = this.initialState
    // this.getDirections()
  }
  resetMap = async () => {
    this.closeWindow()
    document.getElementById("searchBox").value = ""
    let newState = { ...this.state }
    newState.center.lat = 52.070499
    newState.center.lng = 4.3007
    this.setState({ newState })
    this.state.mapInstance.setCenter(this.state.center);
    this.state.mapInstance.setZoom(13);
    await this.menuSelect(null, true)
  }
  menuSelect = async (menu, reset) => {
    await this.closeWindow()
    let rawData = [...this.state.selectedCategory]
    await rawData.map((data, id) => {
      if (reset) {
        if (id === 0 || id === 3) {
          data.isSelected = true
        } else {
          data.isSelected = false
        }
      } else {
        if (data.id === menu) {
          data.isSelected = !data.isSelected
        }
      }

    })
    if (Object.keys(this.state.markerCluster).length) {
      console.log(this.state.markerCluster)
      this.state.markerCluster.clearMarkers();
    }
    if (this.state.allMarkers.length) {
      for (var i = 0; i < this.state.allMarkers.length; i++) {
        this.state.allMarkers[i].setMap(null);
      }
    }
    await this.setState({ selectedCategory: rawData, allMarkers: [] })
    // new MarkerClusterer(null, this.state.allMarkers)
    await this.populateMarker()
  }
  async getDirections() {
    var targetUrl = 'https://cors-anywhere.herokuapp.com/https://b18e8d85-eafc-4e77-90fa-5fda27fc9e64-bluemix.cloudant.com/parking_locations_denhaag/331bb3fdf1acc1a3080195985529102e'
    const username = "ornestorpredandemalocere"
    const password = "3f9d9541c444c0e8b880d9272d661f4ffe9370dc"
    var basicAuth = 'Basic ' + btoa(username + ':' + password);
    var headers = new Headers();
    headers.set('Authorization', basicAuth);
    try {
      const result = await fetch(targetUrl, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': basicAuth
        }
      })
      const finalRes = await result.json();
      await this.setState({ maxThershold: finalRes.thresholds.maximum, minThreshold: finalRes.thresholds.minimum, radius: finalRes.radius })
    } catch (err) {
      this.setState({ maxThershold: 60, minThreshold: 20 })
    }

  }
  async componentWillMount() {
    document.title = "parkinghero-denhaag";
  }
  closeWindow = () => {
    if (this.state.infowindow) {
      this.state.infowindow.close()
    }
    this.setState({ infowindow: null, showInfo: false })
  }
  handleApiLoaded = (map, maps) => {
    this.setState({
      mapApiLoaded: true,
      mapInstance: map,
      mapApi: maps,
      parkData: []
    });
    this.populateMarker(this.state.center)
  };
  addPlace = async (place) => {
    await this.closeWindow();
    this.setState({ places: place });
    let newState = { ...this.state }
    newState.center.lat = place[0].geometry.location.lat()
    newState.center.lng = place[0].geometry.location.lng()
    let marker = new this.state.mapApi.Marker({
      map: this.state.mapInstance,
      position: place[0].geometry.location,
      animation: this.state.mapApi.Animation.DROP,
    });
    this.populateMarker(newState)
  };

  populateMarker = async (place) => {
    this.setState({ isLoading: true })
    await this.getDirections()
    var service = new this.state.mapApi.places.PlacesService(this.state.mapInstance);
    await service.nearbySearch({
      location: this.state.center,
      radius: this.state.radius,
      type: ['parking']
    }, async (resultsApi, status) => {
      resultsApi = [...resultsApi]
      let result = []
      let leastSelected = await this.state.selectedCategory.find(ns => (ns.icon !== "google" && ns.isSelected))
      if (leastSelected) {
        let url = `https://smartflowapi.eu-gb.mybluemix.net/device`;
        let { data } = await axios.post(url, {
          "selector": {
            "deviceInfo.deviceClass": "DenHaag"
          }
        }, { headers: { 'X-Yazamtec-Client-Id': "8bff1e7f-45e1-48e5-b63d-0b7b2d50a8b3" } });
        let activatedCat = []
        await this.state.selectedCategory.map(cats => {
          if (cats.isSelected) {
            activatedCat.push(cats.icon)
          }
        })
        let rawResult = await data.docs.filter(itemX => activatedCat.includes(itemX.metadata.Location_Class));
        var helper = {};
        result = await rawResult.reduce(function (r, o) {
          o.used = [o]
          var key = o.metadata.Street + '-' + o.metadata.Location_Class;
          if (!helper[key]) {
            helper[key] = Object.assign({}, o); // create a copy of o
            r.push(helper[key]);
          } else {
            helper[key].used.push(o);
          }
          return r;
        }, []);
      }

      let results = result
      let googleSelected = await this.state.selectedCategory.find(ns => (ns.icon === "google" && ns.isSelected))
      if (googleSelected) {
        results = [...resultsApi, ...result]
      }
      console.log("sd", results)

      if (!results.length) {
        return this.setState({ isLoading: false })
      }
      let markers = []
      for (var i = 0; i < results.length; i++) {
        var myLatLng = { lat: -25.363, lng: 131.044 };
        let icon = {
          url: "./assets/menu_icons/google.png", // url
          scaledSize: new this.state.mapApi.Size(30, 30), // scaled size
          origin: new this.state.mapApi.Point(0, 0), // origin
          anchor: new this.state.mapApi.Point(0, 0) // anchor
        };
        let totalUsed = 0
        let occupiedCount = 0;
        let availabilityMsg = "";
        if (results[i].deviceInfo) {
          let type = results[i].metadata.Location_Class
          totalUsed = results[i].used.length
          results[i].used.map(dt => {
            if (dt.deviceInfo.description === "Busy") {
              occupiedCount += 1;
            }
          })
          let iconType = `an_${type}_green.png`
          availabilityMsg = "<span class='highAvailabity'>Hoge beschikbaarheid</span>"
          if (occupiedCount > 0) {
            let occupiedPercentage = (100 * occupiedCount) / totalUsed
            if (occupiedPercentage < this.state.minThreshold) {
              availabilityMsg = "High Availability"
              iconType = `an_${type}_green.png`
            } else if (occupiedPercentage < this.state.maxThershold) {
              availabilityMsg = "<span class='mediumAvailabity'>Niet te druk</span>"
              iconType = `an_${type}_orange.png`
            } else {
              availabilityMsg = "<span class='lowAvailabity'>Druk</span>"
              iconType = `an_${type}_red.png`
            }
          }
          icon = {
            url: `./assets/marker_icons/${iconType}`, // url
            scaledSize: new this.state.mapApi.Size(30, 30), // scaled size
            origin: new this.state.mapApi.Point(0, 0), // origin
            anchor: new this.state.mapApi.Point(0, 0) // anchor
          };
          myLatLng = { lat: parseFloat(results[i].geometry.coordinates[1]), lng: parseFloat(results[i].geometry.coordinates[0]) };
        } else {
          myLatLng = { lat: results[i].geometry.location.lat(), lng: results[i].geometry.location.lng() }
        }
        // var labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let marker = new this.state.mapApi.Marker({
          map: this.state.mapInstance,
          position: myLatLng,
          animation: this.state.mapApi.Animation.DROP,
          icon: icon,
          size: new this.state.mapApi.Size(10, 10),
          markerInfo: results[i],
          totalUsed: totalUsed,
          occupiedCount: occupiedCount,
          availabilityMsg: availabilityMsg,
          // label: labels[i % labels.length]
          // map: this.state.mapApi
        });

        var infowindow = null;
        marker.addListener('click', (d) => {
          this.state.mapInstance.setCenter(marker.getPosition());
          this.setState({ showInfo: false })
          let markerInfo = marker.markerInfo
          if (infowindow) {
            infowindow.close();
          }
          if (markerInfo.deviceInfo) {
            infowindow = new this.state.mapApi.InfoWindow({
              content: `<span class='locationTextLarge'>${markerInfo.metadata.Street}<br/>${markerInfo.metadata.City}</span><br>${marker.availabilityMsg}`
            });
          } else {
            // let imageUrl = markerInfo.photos ? markerInfo.photos[0].getUrl() : "";
            // let openStatus = markerInfo.opening_hours ? markerInfo.opening_hours.open_now ? "Open" : "Gesloten" : ""
            infowindow = new this.state.mapApi.InfoWindow({
              content: `<span class='locationTextLarge'>${markerInfo.name}<br/>${markerInfo.vicinity}</span>`
            });
          }
          infowindow.open(this.state.mapApi, marker);
          var self = this;
          // console.log(markerInfo)
          self.setState({ showInfo: true, markerInfo: markerInfo, infowindow: infowindow, totalUsed: marker.totalUsed, occupiedCount: marker.occupiedCount })
          this.state.mapApi.event.addListener(infowindow, 'closeclick', (function (i) {
            infowindow.close()
            self.setState({ showInfo: false, markerInfo: markerInfo, infowindow: infowindow })
          }));
        }
        );

        markers.push(marker)
        this.setState({ allMarkers: markers, isLoading: false })


      }
      var markerCluster = new MarkerClusterer(this.state.mapInstance, markers,
        { imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m' });
      this.setState({ markerCluster: markerCluster })

    });
  }

  renameType = (typeName) => {
    let text;
    switch (typeName) {
      case "public":
        text = "Straat parkeren";
        break;
      case "taxi":
        text = "Taxi";
        break;
      case "pickup":
        text = "Ophalen en bezorgen";
        break;
      case "truck":
        text = "Vrachtwagen";
        break;
      case "disabled":
        text = "Invalide";
        break;
      case "touringbus":
        text = "Toeristen bus";
        break;
      case "valet":
        text = "Valet parking";
        break;
      case "electric":
        text = "Laadstation";
        break;
      default:
        text = "Parkeren niet toegestaan";
    }
    return text;
  }
  createMapOptions = (maps) => {
    // console.log(this.state, maps)
    return {
      mapTypeControl: true,
      fullscreenControl: false,
      zoomControl: false,
      mapTypeIds: ['roadmap', 'terrain'],
      mapTypeControlOptions: {
        style: this.state.mapApi ? this.state.mapApi.MapTypeControlStyle.DROPDOWN_MENU : null,
        // position: this.state.mapApi ? this.state.mapApi.ControlPosition.TOP_CENTER : null
      },
    }
  }
  closeModal = () => {
    // console.log("click close modal")
    this.setState({ isActiveModal: false })
  }
  renderImage = () => {
    let imageUrl = ""
    if (this.state.markerInfo.deviceInfo) {
      let imageSource = `./assets/menu_icons/${this.state.markerInfo.metadata.Location_Class}.png`
      return <img style={{ height: 116, marginTop: 7 }}
        src={imageSource}
        alt="new"
      />
    } else {
      if (this.state.markerInfo.photos) {
        // console.log("photos", this.state.markerInfo.photos[0].getUrl())
        imageUrl = this.state.markerInfo.photos[0].getUrl()

        return <img style={{ height: 116, width: 116, marginTop: 7 }}
          src={imageUrl}
          alt="new"
        />
      } else {
        return <img style={{ height: 116, width: 116, marginTop: 7 }}
          src="./assets/menu_icons/google.png"
          alt="new"
        />
      }
    }

  }
  gotoMap = () => {
    let address = "";
    if (this.state.markerInfo.deviceInfo) {
      address = this.state.markerInfo.metadata.Street
    } else {
      address = this.state.markerInfo.name
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${address}`
    var win = window.open(url, '_blank');
    win.focus();
    // console.log(address)
  }
  renderDetails = () => {
    if (this.state.markerInfo.deviceInfo) {
      return (
        <span> <p> Beschikbare parkeerplaatsen: {this.state.totalUsed - this.state.occupiedCount}</p>
          <p>Totale parkeerplaatsen: {this.state.totalUsed}</p>
          <p>Type: {this.renameType(this.state.markerInfo.metadata.Location_Class)}</p>
        </span>

      )
    } else {
      return (
        <span>
          {/* <p>{this.state.markerInfo.name}</p>
          <p>{this.state.markerInfo.vicinity}</p> */}
          <p>Status: {this.state.markerInfo.opening_hours ? "Open" : "Gesloten"}</p>
          <p>Type: Parkeergarage</p>
        </span>

      )
    }
  }
  render() {
    const {
      places, mapApiLoaded, mapInstance, mapApi,
    } = this.state;
    return (
      <div>
        <div className="map-canvas">
          <div className="nav">
            <ul className="horizontal-list">
              {this.state.selectedCategory.map((catVal, i) => {
                return (<li key={i}>
                  <a onClick={(e) => { e.preventDefault(); this.menuSelect(catVal.id) }}>
                    <img className={`menuIcon ${!catVal.isSelected ? 'fadeIcon' : null}`}
                      src={`./assets/menu_icons/${catVal.icon}.png`}
                      alt="new"
                    /></a></li>)
              })}
            </ul>
          </div>

          <GoogleMapReact
            bootstrapURLKeys={{
              key: "AIzaSyAyIvCIJ8K57oZ0Hra-TPJWOAP8gjiJ7E8",
              libraries: ['places', 'geometry'],
            }}
            defaultCenter={this.state.center}
            defaultZoom={this.state.zoom}
            options={this.createMapOptions()}
            yesIWantToUseGoogleMapApiInternals
            onGoogleApiLoaded={({ map, maps }) => this.handleApiLoaded(map, maps)}
          >
          </GoogleMapReact>
          {mapApiLoaded && <SearchBox map={mapInstance} mapApi={mapApi} addplace={this.addPlace} />}
          <div className="resetButton"> <a onClick={(e) => { this.resetMap() }}>
            <img className={`reloadIcon`}
              src={`./reload.png`}
              alt="new"
            /></a></div>
          {this.state.showInfo && <div className="bottomContainer"><div className="innerDiv">
            <div className="topC">
              <div className="leftImage">
                {this.renderImage()}
              </div>
              <div className="rightImagePart">
                <div className="closeBtn">
                  <button className="delete" onClick={() => this.closeWindow()}></button>
                </div>
                <div className="descriptionSpot">
                  {this.renderDetails()}
                </div>
              </div>
            </div>
            <div className="footerC">
              <button className="button is-dark fullWidth" onClick={() => this.gotoMap()}>Take me there</button>
            </div>
          </div></div>}
          {this.state.isLoading &&
            <div className="pageloader opacityLow is-active"><span className="title">Loading...</span></div>
          }
        </div>
        <div className="container-fluid background-gradient">
          <Row >
            <Col sm="8">
              <Row className="div-width">
                <Col className="park-location" sm="12">
                  <p className="text-center bold-animation">Parkeerlocaties</p>
                  <p className="text-indent">Waar wil jij parkeren?</p>
                  <Row className="park-content">
                    <Col sm="4">
                      <Row>
                        <Col sm="12">
                          <img src='./assets/menu_icons/disabled.png' className="img-sec" />
                          <label className="text-indent">Gehandicapten</label>
                        </Col>
                      </Row>
                    </Col>
                    <Col sm="4">
                      <Row>
                        <Col sm="12">
                          <img src='./assets/menu_icons/public.png' className="img-sec" />
                          <label className="text-indent">Straatparkeren</label>
                        </Col>
                      </Row>
                    </Col>
                    <Col sm="4">
                      <Row>
                        <Col sm="12">
                          <img src='./assets/menu_icons/truck.png' className="img-sec" />
                          <label className="text-indent">Vrachtwagen</label>
                        </Col>
                      </Row>
                    </Col>
                  </Row>
                  <Row className="park-content">
                    <Col sm="4">
                      <Row>
                        <Col sm="12">
                          <img src='./assets/menu_icons/electric.png' className="img-sec" />
                          <label className="text-indent">Laadpaal elektrishce

auto</label>
                        </Col>
                      </Row>
                    </Col>
                    <Col sm="4">
                      <Row>
                        <Col sm="12">
                          <img src='./assets/menu_icons/taxi.png' className="img-sec" />
                          <label className="text-indent">Taxi</label>
                        </Col>
                      </Row>
                    </Col>
                    <Col sm="4">
                      <Row>
                        <Col sm="12">
                          <img src='./assets/menu_icons/valet.png' className="img-sec" />
                          <label className="text-indent">Valet parking</label>
                        </Col>
                      </Row>
                    </Col>
                  </Row>
                  <Row className="park-content">
                    <Col sm="4">
                      <Row>
                        <Col sm="12">
                          <img src='./assets/menu_icons/pickup.png' className="img-sec" />
                          <label className="text-indent">Laden en lossen</label>
                        </Col>
                      </Row>
                    </Col>
                    <Col sm="4">
                      <Row>
                        <Col sm="12">
                          <img src='./assets/menu_icons/touringbus.png' className="img-sec" />
                          <label className="text-indent">Toeristenbus</label>
                        </Col>
                      </Row>
                    </Col>
                    <Col sm="4">
                      <Row>
                        <Col sm="12">
                          <img src='./assets/menu_icons/google.png' className="img-sec" />
                          <label className="text-indent">Parkeergarage</label>
                        </Col>
                      </Row>
                    </Col>
                  </Row>
                </Col>
              </Row>
            </Col>
            <Col sm="4">
              <Row className="div-width">
                <Col sm="12" className="park-location-2">
                  <p className="text-indent bold-questions text-height-2">Hoe druk is de
parkeerlocatie?</p>
                  <Row className="circle-conent">
                    <Col sm="12">
                      <span className="dot"></span>
                      <label className="text-indent-2">Erg druk</label>
                    </Col>
                  </Row>
                  <Row className="circle-conent">
                    <Col sm="12">
                      <span className="doty"></span>
                      <label className="text-indent-2">Niet te druk</label>
                    </Col>
                  </Row>
                  <Row className="circle-conent">
                    <Col sm="12">
                      <span className="dotg"></span>
                      <label className="text-indent-2">Slimme keuze!</label>
                    </Col>
                  </Row>
                </Col>
              </Row>
            </Col>
          </Row>
          <Row>
            <Col sm="4">
              <div className="per-sec">

                <p className="des-text"><span className="bold-questions">Parking Hero</span></p>
                <p className="des-text">Weet altijd een
parkeerplaats voor je te
vinden!</p>
                <p className="des-text">Mocht de parkeerplaats
intussen bezet zijn, niet
getreurd: ParkingHero
toont je meteen andere
vrije parkeerplaatsen in de
buurt!</p>

              </div>
            </Col>
            <Col sm="4">
              <div className="mid-sec">

                <p className="des-text"><span className="bold-questions">Parking Hero</span></p>
                <p className="des-text">Optimaliseert uw autorit én
bespaart u benzine! Dit kan
zorgen voor een tijdsbesparing
die oploopt tot wel 50%.</p>
                <p className="des-text">Dit is niet alleen efficiënt, maar
ook goed voor je
portemonnee!</p>

              </div>
            </Col>
            <Col sm="4" >
              <div className="last-sec">

                <p className="des-text"><span className="bold-questions">Parking Hero</span></p>
                <p className="des-text">Is voor iedereen en werkt op
alle apparaten. ParkingHero zal
de stad schoner, veiliger en
slimmer maken!</p>
                <p className="des-text">ParkingHero besteedt extra
aandacht aan mensen met een
lichamelijke beperking, en zal
altijd een geschikte
parkeerplaats voor hen vinden.</p>

              </div>
            </Col>
          </Row>
          <Row>
            <p className="text-center how-work bold-animation">Hoe het werkt</p>
            <Col sm="4">
              <div className="per-sec">

                <p className="text-center text-height"><span className="bold-questions">Download Parking Hero</span></p>
                <p className="text-center text-height">iOS & Android</p>
                <img src='./assets/menu_icons/map.jpg' className="last-img-sec" />

              </div>
            </Col>
            <Col sm="4">
              <div className="mid-sec">

                <p className="text-center text-height"><span className="bold-questions">Type je bestemming in</span></p>
                <p className="text-center text-height">Selecteer en parkeerlocatie en druk op “Take Me There”</p>
                <img src='./assets/menu_icons/take.jpg' className="last-img-sec" />
              </div>
            </Col>
            <Col sm="4" >
              <div className="last-sec">

                <p className="text-center text-height"><span className="bold-questions">Geniet van een stressvrije rit naar een vrije parkeerplek!</span></p>
                <p className="text-center text-height">ParkingHero zal je altijd naar een lege parkeerplaats begeleiden</p>
                <img src='./assets/menu_icons/dark.jpg' className="last-img-sec" />
              </div>
            </Col>
          </Row>

        </div>
      </div>
    )
  }
}

export default App;
