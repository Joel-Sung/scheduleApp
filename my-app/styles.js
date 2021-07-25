import { StyleSheet } from 'react-native';

module.exports = StyleSheet.create({
	logInContainer: {
		flex: 1,
		alignItems: 'center',
		backgroundColor: 'white',
	},
	input: {
		width: 200,
		fontFamily: 'Baskerville',
		fontSize: 20,
		height: 44,
		padding: 10,
		borderWidth: 1,
		borderColor: 'black',
		marginVertical: 10,
	},
	longInput: {
		width: 300,
		fontFamily: 'Baskerville',
		fontSize: 20,
		height: 44,
		padding: 10,
		borderWidth: 1,
		borderColor: 'black',
		marginVertical: 10,
	},
	container: {
		flex: 1,
		backgroundColor: '#fff',
		alignItems: 'center',
	},
	instructions: {
		color: '#888',
		fontSize: 18,
		marginHorizontal: 15,
	}, 
	button: {
		backgroundColor: 'white',
		borderColor: 'black',
		borderWidth: 2,
		borderRadius: 15,
		padding: 3,
		margin: 5,
		alignItems: 'center'   
	},
	buttonText: {
		color: '#000',
	}, 
	dropdown: {
		alignSelf: 'center',
		width: 150,
		fontSize: 16,
		paddingVertical: 12,
		paddingHorizontal: 10,
		borderWidth: 1,
		borderColor: 'gray',
		borderRadius: 4,
		color: 'black',
	},
	timePicker: {
		width: 320, 
		height: 125,
		backgroundColor: "white"
	},
	timeContainer: {
		flexDirection: 'row',
		backgroundColor: 'darkgrey',
	},
	time: {
		flex: 7,
		color: 'white',
		fontSize: 18,
		fontWeight: 'bold',
		padding: 5,
		width: 350,
	},
	editButton: {
		flex: 3,
	},
	details: {
		backgroundColor: 'white',
		color: 'black',
		fontSize: 16,
		padding: 5,
		width: 350,
		borderColor: 'black',
		borderWidth: 2
	}
});