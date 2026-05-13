import { Component, OnInit } from '@angular/core';
import { Firebase } from '../services/firebase';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  constructor(private firebaseService: Firebase) {}

  async ngOnInit() {
    const data = await this.firebaseService.getEdificios();
    console.log('Edificios:', data);
  }
}