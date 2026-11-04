// Package main runs a small web service that keeps a list of notes.
package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sync"
)

const addr = ":8080"

var ErrEmpty = errors.New("note is empty")

type Note struct {
	ID   int    `json:"id"`
	Text string `json:"text"`
}

type Store struct {
	mu    sync.Mutex
	notes []Note
	next  int
}

func (s *Store) Add(text string) (Note, error) {
	if text == "" {
		return Note{}, ErrEmpty
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.next++
	n := Note{ID: s.next, Text: text}
	s.notes = append(s.notes, n)
	return n, nil
}

func (s *Store) handleNotes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.mu.Lock()
		defer s.mu.Unlock()
		json.NewEncoder(w).Encode(s.notes)
	case http.MethodPost:
		var in Note
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		n, err := s.Add(in.Text)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		json.NewEncoder(w).Encode(n)
	}
}

func main() {
	store := &Store{}
	done := make(chan bool)
	go func() {
		log.Println("listening on", addr)
		done <- true
	}()
	<-done
	http.HandleFunc("/notes", store.handleNotes)
	log.Fatal(http.ListenAndServe(addr, nil))
}
