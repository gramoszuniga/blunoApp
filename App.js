import React, { Component, Fragment } from 'react';
import {
  AppState,
  Button,
  PermissionsAndroid,
  Picker,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet
} from 'react-native';
import { Colors } from 'react-native/Libraries/NewAppScreen';
import BleManager from 'react-native-ble-manager';
import Geolocation from '@react-native-community/geolocation';

const PERIPHERAL_ID = '1C:BA:8C:1D:88:55';
const SERVICE_UUID = '0000dfb0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000dfb1-0000-1000-8000-00805f9b34fb';
const MSG_0 = [48]; // 0x30
const MSG_1 = [49]; // 0x31
const MSG_2 = [50]; // 0x32
const DARKSKY_BASE_URL = 'https://api.darksky.net/forecast/';
const DARKSKY_TOKEN = 'f71e2a96749b143110e210b9835dde00';
const DARKSKY_EXCLUDE = 'currently,minutely,hourly,alerts,flags';
const TIMEOUT = 10000;
const INTERVAL = 90000;
var intervalId;

export default class App extends Component {
  constructor() {
    super();
    this.state = {
      appState: AppState.currentState,
      selectedPoP: 0
    };
  }

  componentDidMount() {
    if (Platform.OS === 'android' && Platform.Version >= 23) {
      PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]).then((result) => {
        if (result) {
          console.warn('User accepted');
        } else {
          console.warn('User refused');
        }
      });
    }

    BleManager.start({ showAlert: true }).then(() => {
      console.warn('Success: BLEManager initialized');
    }).catch((err) => {
      console.warn('Error: ', err);
    });

    AppState.addEventListener('change', this.handleAppStateChange);
  }

  componentWillUnmount() {
    clearInterval(intervalId);
    BleManager.disconnect(PERIPHERAL_ID);
    AppState.removeEventListener('change', this.handleAppStateChange);
  }

  handleAppStateChange = (nextAppState) => {
    if (nextAppState.match(/inactive|background/) && this.state.appState === 'active') {
      clearInterval(intervalId);
      console.warn('TIMER STOPPED');
    }
    this.setState({ appState: nextAppState });
  };

  btnConnect_OnPress() {
    BleManager.connect(PERIPHERAL_ID).then(() => {
      console.warn('Success: Connected');
      BleManager.retrieveServices(PERIPHERAL_ID).then((peripheralInfo) => {
        console.warn('Success: Services retrieved', peripheralInfo);
        this.writeToBluno(MSG_1);
      }).catch((err) => {
        console.warn('Error: ', err);
      });
    }).catch((err) => {
      console.warn('Error: ', err);
    });
  }

  btnOn_OnPress() {
    this.writeToBluno(MSG_0);
  }

  btnOff_OnPress() {
    this.writeToBluno(MSG_2);
  }

  async pkrPoP_OnValueChange(value) {
    clearInterval(intervalId);
    await this.setState({ selectedPoP: value });
    console.warn(this.state);
    this.evaluatePoP();
    intervalId = setInterval(() => this.evaluatePoP(), INTERVAL);
  }

  async evaluatePoP() {
    let isConnected = await BleManager.isPeripheralConnected(PERIPHERAL_ID, []);
    if (isConnected) {
      try {
        let position = await this.getPosition();
        let forecast = await this.getForecast(position.coords.latitude, position.coords.longitude);
        console.warn('PoP: ', forecast.daily.data[0].precipProbability);
        if (forecast.daily.data[0].precipProbability < this.state.selectedPoP) {
          this.writeToBluno(MSG_2);
          console.warn('PoP < Selected PoP');
        } else {
          this.writeToBluno(MSG_0);
          console.warn('PoP >= Selected PoP');
        }
      } catch (err) {
        console.warn('Error: ', err);
      }
    }
  }

  writeToBluno(message) {
    BleManager.write(PERIPHERAL_ID, SERVICE_UUID, CHARACTERISTIC_UUID, message).then(() => {
      console.warn('BLE msg sent');
    }).catch((err) => {
      console.warn('Error: ', err);
    });
  }

  getPosition() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          console.warn('GPS LONG: ' + position.coords.longitude + ' LAT: ' + position.coords.latitude);
          resolve(position);
        },
        err => {
          Geolocation.getCurrentPosition(
            position => {
              console.warn('WIFI LONG: ' + position.coords.longitude + ' LAT: ' + position.coords.latitude);
              resolve(position);
            },
            err => {
              return reject(err);
            }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: TIMEOUT,
          maximumAge: 1000
        }
      );
    });
  }

  // https://api.darksky.net/forecast/[key]/[latitude],[longitude]?exclude=[blocks]
  async getForecast(latitude, longitude) {
    return new Promise(async (resolve, reject) => {
      try {
        let response = await fetch(DARKSKY_BASE_URL + DARKSKY_TOKEN + '/' + latitude + ',' + longitude + '?exclude=' + DARKSKY_EXCLUDE);
        let responseJson = await response.json();
        resolve(responseJson);
      } catch (err) {
        return reject(err);
      }
    });
  }

  render() {
    return (
      <Fragment>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <SafeAreaView style={styles.safeAreaView}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'space-evenly'
            }}
            styles={styles.scrollView}>
            <Button
              title="CONNECT"
              onPress={() => this.btnConnect_OnPress()}
            />
            <Button
              title="ON"
              onPress={() => this.btnOn_OnPress()}
            />
            <Button
              title="OFF"
              onPress={() => this.btnOff_OnPress()}
            />
            <Picker
              selectedValue={this.state.selectedPoP}
              onValueChange={(value) => this.pkrPoP_OnValueChange(value)}>
              <Picker.Item label="0%" value="0" />
              <Picker.Item label="10%" value="0.1" />
              <Picker.Item label="20%" value="0.2" />
              <Picker.Item label="30%" value="0.3" />
              <Picker.Item label="40%" value="0.4" />
              <Picker.Item label="50%" value="0.5" />
              <Picker.Item label="60%" value="0.6" />
              <Picker.Item label="70%" value="0.7" />
              <Picker.Item label="80%" value="0.8" />
              <Picker.Item label="90%" value="0.9" />
              <Picker.Item label="100%" value="1" />
            </Picker>
          </ScrollView>
        </SafeAreaView>
      </Fragment>
    )
  }
};

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1
  },
  scrollView: {
    backgroundColor: Colors.lighter
  }
});