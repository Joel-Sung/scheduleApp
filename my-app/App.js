import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, View, TextInput, TouchableWithoutFeedback, Keyboard, ScrollView } from 'react-native';

const styles = require('./styles.js')

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const MainStack = createStackNavigator();
const Tab = createMaterialTopTabNavigator();
const BotTab = createBottomTabNavigator();

import * as firebase from 'firebase';
import 'firebase/firestore';

const config = {
    /* Insert firestore config here */
};
if (!firebase.apps.length) {
    firebase.initializeApp(config);
} else {
    firebase.app(); // if already initialized, use that one
}
const db = firebase.firestore();

import RNPickerSelect from "react-native-picker-select";
import RNDateTimePicker from "@react-native-community/datetimepicker";

export default function App() {

    const [user, setUser] = useState('');
    const [schedule, setSchedule] = useState(null);

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    return (
        <NavigationContainer>
            <MainStack.Navigator mode="modal" screenOptions={{
                    headerStyle: {
                        backgroundColor: 'gray',
                    },
                    headerTintColor: '#fff',
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                }}
            >
                <MainStack.Screen name="Start" component={Start} />
                <MainStack.Screen name="Home" component={Home} />
                <MainStack.Screen name="NewEvent" component={NewEvent} />
            </MainStack.Navigator>
        </NavigationContainer>
    );

    /* ---------- Start Page ---------- */
    function Start({ navigation }) {
        return (
            <BotTab.Navigator>
                <BotTab.Screen name="Log in" component={LogIn} />
                <BotTab.Screen name="Create account" component={CreateAcc}/>
            </BotTab.Navigator>
                
        )
    }

    async function login(username, password, navigation) {
        const document = await db.collection("users").doc(username).get();
        const data = await document.data();
        if (document.exists) {
            if (password == data.password) {
                setUser(username);
                setSchedule(data.schedule);
                navigation.navigate('Home');
            } else {
                alert('Password is incorrect');
            }
        } else {
            alert('Username does not exist.');
        }
    }
    function LogIn({ navigation }) {
        const [username, setUsername] = useState('');
        const [password, setPassword] = useState('');
        return (
            <View style={styles.logInContainer}>
                <TextInput value={username} placeholder='Username' style={styles.input} 
                    onChangeText={(username) => setUsername(username)}/>
                <TextInput value={password} placeholder='Password' style={styles.input}
                    onChangeText={(password) => setPassword(password)}/>
                <Button func={() => {
                    login(username, password, navigation);
                }} text='Log in' width={100} fontSize={15} />
            </View>
        )
    }

    async function newAcc(username, password, navigation) {
        if (username == "") {
            alert('Enter a username.');
        } else if (password == "") {
            alert('Enter a password.');
        } else {
            const document = await db.collection("users").doc(username).get();
            if (document.exists) {
                alert('Username already exists.')
            } else {
                const blankSchedule = days.map((day) => {
                    return { events:[] };
                });
                setUser(username);
                setSchedule(blankSchedule);
                await db.collection("users").doc(username).set({
                    username: username, 
                    password: password,
                    schedule: blankSchedule
                }).then(() => {
                    navigation.navigate('Home');
                });
            }
        }
    }
    function CreateAcc({ navigation }) {
        const [username, setUsername] = useState('');
        const [password, setPassword] = useState('');
        return (
            <View style={styles.logInContainer}>
                <TextInput value={username} placeholder='Username' style={styles.input} 
                    onChangeText={(username) => setUsername(username)}/>
                <TextInput value={password} placeholder='Password' style={styles.input}
                    onChangeText={(password) => setPassword(password)}/>
                <Button func={() => {
                    newAcc(username, password, navigation);
                }} text='Create account' width={150} fontSize={15} />
            </View>
        )
    }

    /* ---------- Home Page ---------- */
    async function saveData() {
        await db.collection("users").doc(user).update({schedule: schedule});
    }
    function Home({ navigation }) {

        useEffect(() => {
            return saveData;
        })

        React.useLayoutEffect(() => {
            navigation.setOptions({
                title: 'Welcome ' + user,
                headerLeft: () => {
                    return <Button func={() => saveData().then(() => alert('Saved.'))} text='Save' width={55} fontSize={15} />
                },
                headerRight: () => {
                    return <Button func={() => navigation.navigate('Start')} text='Log out' width={65} fontSize={15} />
                }
            });
        }, [navigation]);

        const tabs = days.map((day, index) => {
            return <Tab.Screen key={index} name={day.substr(0, 3)} children={()=>(<Schedule day={day} navigation={navigation} index={index}/>)} />
        });

        return (
            <Tab.Navigator tabBarOptions={{
                labelStyle: { 
                    fontSize: 10,
                    fontWeight: 'bold',
                },
                indicatorStyle: { width: 0 }
            }}
        >
            {tabs}
            </Tab.Navigator>
                
        )
    }

    function Schedule(props) {

        const [events, setEvents] = useState([]);

        useEffect(() => {
            const eventsToday = schedule[props.index].events
            setEvents(eventsToday);
        });

        return (
            <View style={styles.container}>
                <Button text='Create new event' width={200} fontSize={20} 
                    func={() => props.navigation.navigate('NewEvent',{day: props.day, event: {time: null, details: ''}})} 
                />
                {events.length == 0 &&
                    <Text>
                        No events for {props.day}
                    </Text>
                }
                {events.length != 0 &&
                    <ScrollView>
                        {events.map((event, index) => {
                            const date = new Date(event.time);
                            let ampm = '';
                            let hour = date.getHours();
                            if (hour < 12) {
                                if (hour == 0) hour = 12;
                                ampm = 'AM';
                            } else {
                                if (hour != 12) hour -= 12;
                                ampm = 'PM';
                            }
                            const minute = date.getMinutes();
                            const minuteDisplay = minute < 10 ? '0' + minute : minute;
                            return (
                                <View key={index}>
                                    <View style={styles.timeContainer}>
                                        <Text style={styles.time}>
                                            {hour}:{minuteDisplay} {ampm}
                                        </Text>
                                        <View style={styles.editButton}>
                                            <Button text='Edit event' width={90} fontSize={15} 
                                                func={() => props.navigation.navigate('NewEvent',{day: props.day, event: event})} 
                                            />
                                        </View>
                                    </View>
                                    <Text style={styles.details}>
                                        {event.details}
                                    </Text>
                                </View>
                            );
                        })}
                    </ScrollView>
                }
            </View>
        )
    }

    /* ---------- New Event Page ---------- */
    function NewEvent({ route, navigation }) {
    
        const [day, setDay] = useState(route.params.day);
        let dayIndex = days.indexOf(day);
        const [date, setDate] = route.params.event.time == null
            ? useState(new Date())
            : useState(new Date(route.params.event.time));
        const [details, setDetails] = useState(route.params.event.details);

        React.useLayoutEffect(() => {
            navigation.setOptions({
                title: 'Create a new Event',
                headerLeft: () => null,
            });
        }, [navigation]);
    
        return (
            <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()} accessible={false}>
            <View style={styles.container}>
                <RNPickerSelect 
                    style={{ inputIOS: styles.dropdown }}
                    value={day}
                    placeholder={{}}
                    onValueChange={(value) => {
                        setDay(value);
                        dayIndex = days.indexOf(day);
                    }}
                    items={days.map((day) => {
                            return {label: day, value: day};
                        })
                    }
                />
                <RNDateTimePicker mode="time" value={date} style={styles.timePicker} display="spinner"
                    onChange={(event, date) => {
                        const prevEvent = schedule[dayIndex].events.find(findDetails, date);
                        if (prevEvent != undefined) {
                            const copy = {...prevEvent}
                            setDetails(copy.details);
                        } else setDetails('');
                        setDate(date);
                    }}
                />
                <TextInput
                    style={styles.longInput}
                    value={details}
                    onChangeText={(text) => setDetails(text)}
                    multiline={true}
                    numberOfLines={10}
                    minHeight={200}
                    textAlignVertical='top'
                    placeholder="Event Details"
                    require={true}
                />
                <Button func={() => {
                    confirmEvent(date.getTime(), details);
                    navigation.goBack();
                    }} text='Confirm' width={100}/>
                <Button func={() => {
                    deleteEvent();
                    navigation.goBack();
                    }} text='Delete' width={100}/>
                <Button func={() => navigation.goBack()} text='Dismiss' width={100}/>
            </View>
            </TouchableWithoutFeedback>
        )

        function findDetails(event) {
            const eventDate = new Date(event.time);
            return eventDate.getHours() == this.getHours() && eventDate.getMinutes() == this.getMinutes();
        }
        function confirmEvent(time, details) {
            const event = {
                time: time,
                details: details
            }
            const newSchedule = [...schedule];
            let eventIndex = 0;
            const prevEvent = schedule[dayIndex].events.find(findDetails, date);
            if (prevEvent != undefined) {
                eventIndex = schedule[dayIndex].events.indexOf(prevEvent);
                newSchedule[dayIndex].events.splice(eventIndex, 1, event);
            } else {
                eventIndex = sortedIndex(newSchedule[dayIndex].events, time);
                newSchedule[dayIndex].events.splice(eventIndex, 0, event);
            }
            setSchedule(newSchedule);
        }
        function deleteEvent() {
            let eventIndex = 0;
            const prevEvent = schedule[dayIndex].events.find(findDetails, date);
            if (prevEvent != undefined) {
                const newSchedule = [...schedule];
                eventIndex = schedule[dayIndex].events.indexOf(prevEvent);
                newSchedule[dayIndex].events.splice(eventIndex, 1);
                setSchedule(newSchedule);
            } else {
                // Do nothing
            }
        }
    }
    function sortedIndex(array, value) {
        var low = 0,
            high = array.length;
    
        while (low < high) {
            var mid = (low + high) >>> 1;
            if (array[mid].time < value) low = mid + 1;
            else high = mid;
        }
        return low;
    }

    /* ---------- General Components ---------- */
    function Button(props) {
        return (
            <TouchableOpacity
                style={[{width: props.width}, styles.button]}
                onPress={props.func}>
                    <Text style={[{fontSize: props.fontSize}, styles.buttonText]}>{props.text}</Text>
            </TouchableOpacity>
        )
    }
    
}