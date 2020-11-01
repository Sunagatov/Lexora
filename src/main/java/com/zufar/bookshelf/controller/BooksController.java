package com.zufar.bookshelf.controller;

import com.zufar.bookshelf.dao.author.AuthorRepository;
import com.zufar.bookshelf.dao.book.BookRepository;
import com.zufar.bookshelf.dao.book.model.Book;
import com.zufar.bookshelf.dao.country.CountryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

@Controller
@RequiredArgsConstructor
public class BooksController {

    private final AuthorRepository authorRepository;

    private final BookRepository bookRepository;

    private final CountryRepository countryRepository;

    @GetMapping("/books")
    public String getAll(ModelMap modelMap) {
        modelMap.addAttribute("books", bookRepository.findAll());
        return "lists/bookListView";
    }

    @GetMapping("/books/{id}")
    public String get(@PathVariable(value = "id") long id, ModelMap modelMap) {
        modelMap.addAttribute("book", bookRepository.findById(id).get());
        return "profiles/bookProfileView";
    }

    @GetMapping("/addBookForm")
    public String getAddForm(ModelMap modelMap) {
        modelMap.addAttribute("book", new Book());
        modelMap.addAttribute("authors", authorRepository.findAll());
        modelMap.addAttribute("countries", countryRepository.findAll());
        return "crud/addBookView";
    }

    @GetMapping("/updateBookForm/{id}")
    public String getUpdateBookView(@PathVariable(value = "id") long id, ModelMap modelMap) {
        modelMap.addAttribute("book", bookRepository.findById(id).get());
        modelMap.addAttribute("authors", authorRepository.findAll());
        modelMap.addAttribute("countries", countryRepository.findAll());
        return "crud/updateBookView";
    }

    @PostMapping("/books")
    public String add(Book book, ModelMap modelMap) {
        bookRepository.save(book);
        modelMap.addAttribute("books", bookRepository.findAll());
        return "lists/bookListView";
    }

    @PostMapping("/books/{id}")
    public String update(@PathVariable(value = "id") long id, Book book, ModelMap modelMap) {
        book.setId(id);
        bookRepository.save(book);
        modelMap.addAttribute("books", bookRepository.findAll());
        return "lists/bookListView";
    }

    @PostMapping("/deleteBook/{id}")
    public String delete(@PathVariable(value = "id") long id, ModelMap modelMap) {
        bookRepository.deleteById(id);
        modelMap.addAttribute("books", bookRepository.findAll());
        return "lists/bookListView";
    }
}