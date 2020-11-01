package com.zufar.bookshelf.controller;

import com.zufar.bookshelf.dao.country.CountryRepository;
import com.zufar.bookshelf.dao.user.model.User;
import com.zufar.bookshelf.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.PostMapping;

@Controller
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    private final CountryRepository countryRepository;

    @PostMapping("/registration")
    public String getRegistrationPage(ModelMap modelMap) {
        modelMap.addAttribute("user", new User());
        modelMap.addAttribute("countries", countryRepository.findAll());
        return "registrationView";
    }

    @PostMapping("/addUser")
    public String addUser(User user) {
        this.userService.save(user);
        return "home";
    }
}